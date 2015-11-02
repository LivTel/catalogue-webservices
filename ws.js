var sys = require('sys')
	, http = require('http')
	, restify = require('restify')
	, fs = require('fs')
	, cfg = require('./config.json')
	, formidable = require('formidable')
	, util = require('util')
        , path = require('path')
        , mime = require('mime')
        , sqlite3 = require("sqlite3").verbose()
        , pg = require('pg')
        , cp = require('child_process')
	, js2xmlparser = require('js2xmlparser')
	, xml = require('xml')
        , json2html = require('node-json2html')
        , json2csv = require('json2csv')
	; 

function _pg_execute(client, qry, callback) {
    client.query(qry, function(err, result) {
        qry = qry.replace(/\s\s+/g, ' ');   // merge any instances of whitespace to single character
        if (qry.length < 1024) {
            console.log('executed query', "\"" + qry + "\"");
        } else { 
            console.log('executed query', "\"" + qry.substr(0,1024) + " ...\""); 
        }
        callback(err, result);
    });
}

function _slice_usnob_str(s) {
  pos = [12, 1, 12, 1, 10, 10, 1, 3, 1, 3, 1, 6, 1, 6, 1, 6, 1, 1, 1, 3, 1, 3, 1, 1, 1, 1, 1, 1, 1, 4, 1, 5, 1, 1, 1, 5, 1, 2, 1, 13, 1, 5, 1, 1, 1, 5, 1, 2, 1, 13, 1, 5, 1, 1, 1, 5, 1, 2, 1, 13, 1, 5, 1, 1, 1, 5, 1, 2, 1, 13, 1, 5, 1, 1, 1, 5, 1, 2, 1, 13, 1, 4, 7];
  st_position = 0;
  var tmp = [];
  pos.forEach(function(value, index) {
      end_position = st_position + value; 
      tmp.push(s.slice(st_position, end_position).trim());
      st_position = end_position;
  });
  res = {
	'usnobref' : tmp[0],
	'ra' : tmp[4],
	'dec' : tmp[5], 
	'raerrasec' : tmp[7]/1000,
	'decerrasec' : tmp[9]/1000, 
        'bmag1' : tmp[31],
        'rmag1' : tmp[41],
        'bmag2' : tmp[51],
        'rmag2' : tmp[61],
        'distance' : tmp[82]
  };
  return res;
}
   
function scs(req, res, next) {
    console.log("received an scs request");
    cat     = req.params.cat.toLowerCase(), 
    ra      = req.params.ra, 
    dec     = req.params.dec, 
    sr      = req.params.sr, 
    band    = req.params.band, 
    llim    = req.params.llim, 
    ulim    = req.params.ulim, 
    order   = req.params.order, 
    nmax    = req.params.nmax, 
    format  = req.params.format.toLowerCase();

    // RA must be input as decimal
    if (ra.indexOf('.') == -1) {
        ra = ra + '.0';
    }

    switch (cat) {
        case 'apass':   
            console.log("using APASS catalogue");     
            var WHERECLAUSE_MAG = 'AND ' + band + ' >= ' + req.params.llim + ' and ' + band + ' <= ' + ulim;
            var ORDERBYCLAUSE   = ' ORDER BY ' + order;
            var LIMITCLAUSE     = ' LIMIT ' + nmax;

            conString = "postgres://" + cfg.apass.db_user + "@" + cfg.apass.db_host + ":" + cfg.apass.db_port + "/" + cfg.apass.db_name;
            pg.connect(conString, function(err, client) {
                if(err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                }
                qry = "SELECT id as apassref, radeg as ra, decdeg as dec, raerrasec, decerrasec, nightsobs as nobs, \
                       vmag, bmag, gmag, rmag, imag, verr, berr, gerr, rerr, ierr, degrees(coords <-> spoint '(" + ra 
                       + "d," + dec + "d)')*3600 as distance FROM stars WHERE (coords @ scircle '<( " + ra + "d," + dec 
                       + "d)," + sr + "d>' = true) " + WHERECLAUSE_MAG + ORDERBYCLAUSE + LIMITCLAUSE;
                _pg_execute(client, qry, function(err, result) {
                    client.end();
                    if(err) {
                        res.send(400, err);
                        console.error(err);
                        return false;
                    }
                    switch (format) {
                        case 'xml':
                            console.log("outputting as xml");
                            res.header('Content-Type', 'text/xml');
			    var options = {
			        arrayMap: {
			    	sources: "src"
			        }
			    };
                            res.end(js2xmlparser("sources", result.rows, options));
                            break;
                        case 'json':
                            console.log("outputting as json");
                            res.send(result.rows);
                            break;
                        case 'html':
                            console.log("outputting as html");
                            var transform = {'tag':'tr', 
                                             'html':'<td>${apassref}</td><td>${ra}</td><td>${dec}</td><td>${raerrasec}</td><td>${decerrasec}</td><td>${nobs}</td><td>${vmag}</td><td>${bmag}</td><td>${gmag}</td><td>${rmag}</td><td>${imag}</td><td>${verr}</td><td>${berr}</td><td>${gerr}</td><td>${rerr}</td><td>${ierr}</td><td>${distance}</td>'};
                            html = "<table cellpadding=3><tr><td><b>apassref</b><td><b>ra</b></td><td><b>dec</b></td><td><b>raerrasec</b></td><td><b>decerrasec<b/></td><td><b>nobs<b/></td><td><b>vmag</b></td><td><b>bmag</b></td><td><b>gmag</b></td><td><b>rmag</b></td><td><b>imag</b></td><td><b>verr</b></td><td><b>berr</b></td><td><b>gerr</b></td><td><b>rerr</b></td><td><b>ierr</b></td><td><b>distance</b></td></tr>"
                                 + json2html.transform(result.rows, transform) 
                                 + "</table>";
                            res.header('Content-Type', 'text/html');
                            res.end(html);
                            break;
                        case 'csv':
                            console.log("outputting as csv");
                            fields = ['apassref', 'ra', 'raerrasec', 'decerrasec', 'nobs', 'vmag', 'bmag', 'gmag', 'rmag', 'imag', 'verr', 'berr', 'gerr', 'rerr', 'ierr', 'distance'];               
                            json2csv({ data: result.rows, fields: fields }, function(err, csv) {
                                if (err) {
                                    res.send(400, err);
                                    console.error(err);
                                    return false;
                                }
                                res.header('Content-Type', 'text/html');
                                res.end(csv);
                            });
                            break;
                       default:
                            err = {'message' : 'format not recognised'};
                            err['formats_expected'] = ['xml', 'json', 'html', 'csv'];
                            res.send(400, err);
                            console.error(err);
                            return false;
                    }
                });
            });
            break;
        case 'usnob':
            console.log("using USNOB catalogue");
            qry_cmd = cfg.catalogue_root_path + 'bin/' + 'query_usnob';
            switch (band) {
                case 'rmag1':
                    band = 'r1';
                    break;
                case 'rmag2':
                    band = 'r2';
                    break;
                case 'bmag1':
                    band = 'b1';
                    break;
                case 'bmag2':
                    band = 'b2';
                    break;
                default:
                    err = {'message' : 'bad magnitude filter column'};
                    err['columns_expected'] = ['rmag1', 'rmag2', 'bmag1', 'bmag2'];
                    res.send(400, err);
                    console.error(err);
                    return false;
            }
            switch (order) {
                case 'rmag1':
                    order = 'mr1';
                    break;
                case 'rmag2':
                    order = 'mr2';
                    break;
                case 'bmag1':
                    order = 'mb1';
                    break;
                case 'bmag2':
                    order = 'mb2';
                    break;
                case 'ra':
                    order = 'a';
                    break;
                case 'dec':
                    order = 'd';
                    break;
                case 'distance':
                    order = 'r';
                    break;
                default:
                    err = {'message' : 'bad order column'};
                    err['columns_expected'] = ['rmag1', 'rmag2', 'bmag1', 'bmag2', 'ra', 'dec', 'distance'];
                    res.send(400, err);
                    console.error(err);
                    return false;
            }

            qry_params =  ['-R', cfg.catalogue_root_path + 'usnob', '-c', ra + ' ' + dec, '-r', sr*60., '-m', nmax, '-lm' + band, llim + ',' + ulim, '-s' + order];
            console.log('executing query: ' + qry_cmd + ' with parameters ' + qry_params);
            var spawn = cp.spawn
            var child = spawn(qry_cmd, qry_params);
            var out = '';
            child.stdout.on('data', function(buffer) {
                out += buffer.toString();
            });
            child.stdout.on('end', function(){
                var out_json = [];
                out.split('\n').slice(3,-3).forEach(function(value, index) {
                    out_json.push(_slice_usnob_str(value));
                });
                switch (format) {
                    case 'xml':
                        console.log("outputting as xml");
                        res.header('Content-Type', 'text/xml');
			var options = {
			    arrayMap: {
				sources: "src"
			    }
			};
                        res.end(js2xmlparser("sources", out_json, options));
                        break;
                    case 'json':
                        console.log("outputting as json");
                        res.send(out_json);
                        break;
                    case 'html':
                        console.log("outputting as html");
                        var transform = {'tag':'tr', 
                                         'html':'<td>${usnobref}</td><td>${ra}</td><td>${dec}</td><td>${raerrasec}</td><td>${decerrasec}</td><td>${bmag1}</td><td>${bmag2}</td><td>${rmag1}</td><td>${rmag2}</td><td>${distance}</td>'};
                        html = "<table cellpadding=3><tr><td><b>usnobref</b><td><b>ra</b></td><td><b>dec</b></td><td><b>raerrasec</b></td><td><b>decerrasec</b></td><td><b>bmag1<b/></td><td><b>bmag2</b></td><td><b>rmag1</b></td><td><b>rmag2</b></td><td><b>distance</b></td></tr>"
                             + json2html.transform(out_json, transform) 
                             + "</table>";
                        res.header('Content-Type', 'text/html');
                        res.end(html);
                        break;
                    case 'csv':
                        console.log("outputting as csv");
                        fields = ['usnobref', 'ra', 'dec', 'raerrasec', 'decerrasec', 'bmag1', 'bmag2', 'rmag1', 'rmag2', 'distance'];               
                        json2csv({ data: out_json, fields: fields }, function(err, csv) {
                            if (err) {
                                res.send(400, err);
                                console.error(err);
                                return false;
                            }
                            res.header('Content-Type', 'text/html');
                            res.send(csv);
                        });
                        break;
                    default:
                        err = {'message' : 'format not recognised'};
                        err['formats_expected'] = ['xml', 'json', 'html', 'csv'];
                        res.send(400, err);
                        console.error(err);
                        return false;
                }
            });
            break;
        default:
            err = {'message' : 'catalogue not recognised'};
            err['catalogues_expected'] = ['apass', 'usnob'];
            res.send(400, err);
            console.error(err);
            return false;
    }
    return;
}

function skycam_images_delete_by_img_id(req, res, next) {
    console.log("received a skycam_images_delete_by_img_id request");
    schema_name = req.params.schema;
    img_id      = req.params.img_id;
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "DELETE FROM " + schema_name + ".images WHERE img_id = " + img_id;
            _pg_execute(client, qry, function(err, result) {
                client.end(); 
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else {
                    res.send(200);
                } 
                return;
            });            
        }
    });
}

function skycam_images_get_by_img_id(req, res, next) {
    console.log("received a skycam_images_get_by_img_id request");
    schema_name = req.params.schema;
    img_id      = req.params.img_id;
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "SELECT * FROM " + schema_name + ".images WHERE img_id = " + img_id;
            _pg_execute(client, qry, function(err, result) {
                client.end(); 
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else if (result.rows.length == 0) {
                    err = {'message' : 'no images with this img_id found'};
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else {
                    res.send(result.rows);
                } 
                return;
            });            
        }
    });
}

function skycam_images_insert(req, res, next) {
    console.log("received a skycam_images_insert request");
    schema_name = req.params.schema;
    
    // check [vals] argument is valid JSON
    try {
        vals = JSON.parse(req.params.vals);
    } catch(err) {
        res.send(400, err);
        console.error(err);
        return false;
    }
    // check [vals] is populated with all necessary keys required to ingest into database
    keys = ['DATE_OBS',
            'MJD', 
            'UTSTART', 
            'RA_CENT', 
            'DEC_CENT', 
            'RA_MIN', 
            'RA_MAX', 
            'DEC_MIN', 
            'DEC_MAX', 
            'CCDSTEMP', 
            'CCDATEMP', 
            'AZDMD', 
            'AZIMUTH', 
            'ALTDMD', 
            'ALTITUDE', 
            'ROTSKYPA'
    ];
    keys_missing = [];
    keys.forEach(function(entry) {
        if (!(entry in vals)) {
            keys_missing.push(entry);
        }
    });
    if (keys_missing.length>0) {
        err = {'message' : 'key missing or incorrect in vals argument'};
        err['keys_expected'] = keys;
        err['keys_missing']  = keys_missing;
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "INSERT INTO " + schema_name + ".images( \
                img_date, img_rundate, mjd, utstart, ra_cent, dec_cent, ra_min, ra_max, \
                dec_min, dec_max, ccdstemp, ccdatemp, azdmd, azimuth, altdmd, altitude, \
                rotskypa, filename) VALUES ('" + vals.DATE_OBS + "', NOW(), " + vals.MJD + ", '" 
                + vals.UTSTART + "', " + vals.RA_CENT + ", " + vals.DEC_CENT + ", " + vals.RA_MIN 
                + ", " + vals.RA_MAX + ", " + vals.DEC_MIN + ", " + vals.DEC_MAX + ", " 
                + vals.CCDSTEMP + ", " + vals.CCDATEMP + ", " + vals.AZDMD + ", " + vals.AZIMUTH 
                + ", " + vals.ALTDMD + ", " + vals.ALTITUDE + ", " + vals.ROTSKYPA + ", '" 
                + vals.FILENAME + "')  RETURNING img_id, mjd";
            _pg_execute(client, qry, function(err, result) {
                client.end(); 
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else {
                    res.send(result.rows[0]);
                } 
                return;
            });            
        }
    });
}

function skycam_sources_add_source_to_buffer(req, res, next) {
    console.log("received a skycam_sources_add_source_to_buffer request");
    schema = req.params.schema;    
    
    // check [vals] argument is valid JSON
    try {
        vals = JSON.parse(req.params.vals);
    } catch(err) {
        res.send(400, err);
        console.error(err);
        return false;
    }
    // check [vals] is populated with all necessary keys required to ingest into database
    keys = ['img_id',
            'skycamref',
            'mjd', 
            'ra', 
            'dec', 
            'x', 
            'y', 
            'fluxAuto', 
            'fluxErrAuto', 
            'magAuto', 
            'magErrAuto', 
            'background', 
            'isoareaWorld', 
            'SEFlags', 
            'FWHM', 
            'elongation', 
            'ellipticity',
            'thetaImage'
    ];
    keys_missing = [];
    keys.forEach(function(entry) {
        if (!(entry in vals)) {
            keys_missing.push(entry);
        }
    });
    if (keys_missing.length>0) {
        err = {'message' : 'key missing or incorrect in vals argument'};
        err['keys_expected'] = keys;
        err['keys_missing']  = keys_missing;
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    // add requested [schema] name as key in JSON buffer object if it doesn't exist
    if (!(schema in buffer_sources)) {
        buffer_sources[schema] = [];
    }
    
    buffer_sources[schema].push(vals);
    res.send(200);
    return;
}

function skycam_sources_delete_buffer(req, res, next) {
    console.log("received a skycam_sources_delete_buffer request");
    schema  = req.params.schema;  
    
    if (buffer_sources[schema] == undefined) {
        err = {'message' : 'schema doesn\'t exist in buffer or buffer is empty'};
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    delete buffer_sources[schema];
    res.send(200);
    return;
}

function skycam_sources_delete_by_img_id(req, res, next) {
    console.log("received a skycam_sources_delete_by_img_id request");
    schema_name = req.params.schema;
    img_id      = req.params.img_id;
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "DELETE FROM " + schema_name + ".sources WHERE img_id = " + img_id;
            _pg_execute(client, qry, function(err, result) {
                client.end(); 
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else {
                    res.send(200);
                } 
                return;
            });            
        }
    });
}


function skycam_sources_flush_buffer_to_db(req, res, next) {
    console.log("received a skycam_sources_flush_buffer_to_db request");
    schema = req.params.schema;  
    
    if (buffer_sources[schema] == undefined) {
        err = {'message' : 'schema doesn\'t exist in buffer or buffer is empty'};
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    // construct a statement for bulk insertion
    valuesClause = "";
    buffer_sources[schema].forEach(function(entry) {
        valuesClause += "(" + entry.img_id + ", " + entry.skycamref + ", " + entry.mjd + ", " + entry.ra + ", " + entry.dec + ", " + entry.x + 
        ", " + entry.y + ", " + entry.fluxAuto + ", " + entry.fluxErrAuto + ", " + entry.magAuto + ", " + entry.magErrAuto + 
        ", " + entry.background + ", " + entry.isoareaWorld + ", " + entry.SEFlags + ", " + entry.FWHM + ", " + 
        entry.elongation + ", " + entry.ellipticity + ", " + entry.thetaImage + ", spoint(" + entry.ra*(Math.PI/180) + 
        ", " + entry.dec*(Math.PI/180) + ")),";
    });

    valuesClause = valuesClause.substr(0, valuesClause.length-1)    // discard trailing comma
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "INSERT INTO " + schema + ".sources(img_id, skycamref, mjd, ra, dec, x_pix, y_pix, flux, flux_err,\
            inst_mag, inst_mag_err, background, isoarea_world, seflags, fwhm, elongation, ellipticity,\
            theta_image, pos) VALUES " + valuesClause;
            _pg_execute(client, qry, function(err) {
                client.end();
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else {
                    res.send(200);
                    buffer_sources[schema] = [];    // complete flushing process by emptying buffer for this [schema]
                }
                return;
            });            
        }
    });    
}

function skycam_sources_get_buffer(req, res, next) {
    console.log("received a skycam_sources_get_buffer request");
    res.send(buffer_sources);
}

function skycam_sources_get_by_img_id(req, res, next) {
    console.log("received a skycam_sources_get_by_img_id request");
    schema_name = req.params.schema;
    img_id      = req.params.img_id;
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "SELECT * FROM " + schema_name + ".sources WHERE img_id = " + img_id;
            _pg_execute(client, qry, function(err, result) {
                client.end(); 
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else if (result.rows.length == 0) {
                    err = {'message' : 'no sources with this img_id found'};
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else {
                    res.send(result.rows);
                } 
                return;
            });            
        }
    });
}

function skycam_sources_insert(req, res, next) {
    console.log("received a skycam_sources_insert request");
    schema = req.params.schema;  
    
    // check [vals] argument is valid JSON
    try {
        vals = JSON.parse(req.params.vals);
    } catch(err) {
        res.send(400, err);
        console.error(err);
        return false;
    }
    // check [vals] is populated with all necessary keys required to ingest into database
    keys = ['img_id',
            'skycamref',
            'mjd', 
            'ra', 
            'dec', 
            'x', 
            'y', 
            'fluxAuto', 
            'fluxErrAuto', 
            'magAuto', 
            'magErrAuto', 
            'background', 
            'isoareaWorld', 
            'SEFlags', 
            'FWHM', 
            'elongation', 
            'ellipticity',
            'thetaImage'
    ];
    keys_missing = [];
    keys.forEach(function(entry) {
        if (!(entry in vals)) {
            keys_missing.push(entry);
        }
    });
    if (keys_missing.length>0) {
        err = {'message' : 'key missing or incorrect in vals argument'};
        err['keys_expected'] = keys;
        err['keys_missing']  = keys_missing;
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "INSERT INTO " + schema + ".sources(img_id, skycamref, mjd, ra, dec, x_pix, y_pix, flux, flux_err,\
            inst_mag, inst_mag_err, background, isoarea_world, seflags, fwhm, elongation, ellipticity,\
            theta_image, pos) VALUES " + "(" + vals.img_id + ", " + vals.skycamref + ", " + vals.mjd + ", " + vals.ra + ", " + 
            vals.dec + ", " + vals.x + ", " + vals.y + ", " + vals.fluxAuto + ", " + vals.fluxErrAuto + 
            ", " + vals.magAuto + ", " + vals.magErrAuto + ", " + vals.background + ", " + 
            vals.isoareaWorld + ", " + vals.SEFlags + ", " + vals.FWHM + ", " + vals.elongation + 
            ", " + vals.ellipticity + ", " + vals.thetaImage + ", spoint(" + vals.ra*(Math.PI/180) + 
            ", " + vals.dec*(Math.PI/180) + "))";
            _pg_execute(client, qry, function(err) {
                client.end();
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else {
                    res.send(200);
                }
                return;
            });            
        }
    });    
}

var server = restify.createServer();
server.use(restify.bodyParser({}));

server.get('/scs/:cat/:ra/:dec/:sr/:band/:llim/:ulim/:order/:nmax/:format', scs);

server.post('/skycam/tables/images/:schema/:vals', skycam_images_insert);
server.del('/skycam/tables/images/:schema/:img_id', skycam_images_delete_by_img_id);
server.get('/skycam/tables/images/:schema/:img_id', skycam_images_get_by_img_id);

var buffer_sources = {};
server.put('/skycam/tables/sources/buffer/:schema/:vals', skycam_sources_add_source_to_buffer);
server.post('/skycam/tables/sources/buffer/:schema', skycam_sources_flush_buffer_to_db);
server.del('/skycam/tables/sources/buffer/:schema', skycam_sources_delete_buffer);
server.get('/skycam/tables/sources/buffer', skycam_sources_get_buffer);

server.post('/skycam/tables/sources/:schema/:vals', skycam_sources_insert);
server.del('/skycam/tables/sources/:schema/:img_id', skycam_sources_delete_by_img_id);
server.get('/skycam/tables/sources/:schema/:img_id', skycam_sources_get_by_img_id);

server.pre(restify.CORS({
        credentials: true
}));

server.listen(cfg['ws_port'], function() {
	console.log("(ws.js) server running on port " + cfg['ws_port']);
});
