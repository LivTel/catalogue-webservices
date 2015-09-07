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
      
function _destroy_skycam_drop_schema(schema_name, res, client, callback) {
    qry = "DROP SCHEMA " + schema + " CASCADE";
    _pg_execute(client, qry, function(err) {
        if (err) {
            res.send(err);
            return console.error('error running query', err)
        } else {
            callback();
        }
    });
}

function _init_skycam_make_index(table, column, name, res, client, callback) {
    qry = "CREATE INDEX " + name + " ON " + table + " (" + column + ")"
    _pg_execute(client, qry, function(err) {
        if (err) {
            res.send(err);
            return console.error('error running query', err)
        } else {
            callback();
        }
    });    
}

function _init_skycam_make_spatial_index(table, column, name, res, client, callback) {
    qry = "CREATE INDEX " + name + " ON " + table + " USING GIST(" + column + ")";
    _pg_execute(client, qry, function(err) {
        if (err) {
            res.send(err);
            return console.error('error running query', err)
        } else {
            callback();
        }
    });    
}

function _init_skycam_make_schema(schema_name, res, client, callback) {
    qry = "CREATE SCHEMA " + schema_name;
    _pg_execute(client, qry, function(err) {
        if (err) {
            res.send(err);
            return console.error('error running query', err)
        } else {
            callback();
        }
    });
}

function _init_skycam_make_table_images(schema_name, res, client, callback) {
    qry = "CREATE TABLE " + schema_name + ".images ( \
	   img_id bigserial unique primary key, \
           img_date timestamp NOT NULL, \
           img_rundate timestamp NOT NULL, \
           mjd double precision NOT NULL, \
           utstart time NOT NULL, \
           ra_cent double precision NOT NULL, \
           dec_cent double precision NOT NULL, \
           ra_min double precision NOT NULL, \
           ra_max double precision NOT NULL, \
           dec_min double precision NOT NULL, \
           dec_max double precision NOT NULL, \
           ccdstemp double precision NOT NULL, \
           ccdatemp double precision NOT NULL, \
           azdmd double precision NOT NULL, \
           azimuth double precision NOT NULL, \
           altdmd double precision NOT NULL, \
           altitude double precision NOT NULL, \
           rotskypa double precision NOT NULL, \
           filename char(35) NOT NULL \
           );";
    _pg_execute(client, qry, function(err) {
        if (err) {
            res.send(err);
            return console.error('error running query', err)
        } else {
            callback();
        }
    });
}

function _init_skycam_make_table_matchedAPASSObjects(schema_name, res, client, callback) {
    qry = "CREATE TABLE " + schema_name + ".matchedAPASSObjects ( \
           apassref bigserial unique primary key, \
           ra double precision NOT NULL, \
           dec double precision NOT NULL, \
           ra_err double precision NOT NULL, \
           dec_err double precision NOT NULL, \
           v_mag double precision NOT NULL, \
           b_mag double precision NOT NULL, \
           g_mag double precision NOT NULL, \
           r_mag double precision NOT NULL, \
           i_mag double precision NOT NULL, \
           v_mag_err double precision NOT NULL, \
           b_mag_err double precision NOT NULL, \
           g_mag_err double precision NOT NULL, \
           r_mag_err double precision NOT NULL, \
           i_mag_err double precision NOT NULL, \
           n_obs int, \
           pos spoint NOT NULL \
           );"
    _pg_execute(client, qry, function(err) {
        if (err) {
            res.send(err);
            return console.error('error running query', err)
        } else {
            callback();
        }
    });
}

function _init_skycam_make_table_matchedUSNOBObjects(schema_name, res, client, callback) {
    qry = "CREATE TABLE " + schema_name + ".matchedUSNOBObjects ( \
           usnobref char(25) unique primary key, \
           usnobref_int bigserial unique NOT NULL, \
           ra double precision NOT NULL, \
           dec double precision NOT NULL, \
           ra_err double precision NOT NULL, \
           dec_err double precision NOT NULL, \
           r1_mag double precision NOT NULL, \
           b1_mag double precision NOT NULL, \
           b2_mag double precision NOT NULL, \
           r2_mag double precision NOT NULL, \
           pos spoint NOT NULL \
           );"
    _pg_execute(client, qry, function(err) {
        if (err) {
            res.send(err);
            return console.error('error running query', err)
        } else {
            callback();
        }
    });
}

function _init_skycam_make_table_sources(schema_name, res, client, callback) {
    qry = "CREATE TABLE " + schema_name + ".sources ( \
           src_id bigserial unique primary key, \
           img_id bigserial NOT NULL references " + schema_name + ".images(img_id), \
           mjd double precision NOT NULL, \
           ra double precision NOT NULL, \
           dec double precision NOT NULL, \
           x_pix double precision NOT NULL, \
           y_pix double precision NOT NULL, \
           flux double precision NOT NULL, \
           flux_err double precision NOT NULL, \
           inst_mag double precision NOT NULL, \
           inst_mag_err double precision NOT NULL, \
           background double precision NOT NULL, \
           isoarea_world double precision NOT NULL, \
           seflags smallint NOT NULL, \
           fwhm double precision NOT NULL, \
           elongation double precision NOT NULL, \
           ellipticity double precision NOT NULL, \
           theta_image double precision NOT NULL, \
           usnobref char(25) NULL, \
           usnobref_int bigint NULL, \
           apassref bigint NULL, \
           pos spoint NOT NULL \
            );"
    _pg_execute(client, qry, function(err) {
        if (err) {
            res.send(err);
            return console.error('error running query', err)
        } else {
            callback();
        }
    });
} 

function _pg_execute(client, qry, callback) {
    client.query(qry, function(err, result) {
        console.log('executed query: ' + qry);
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
    cat = req.params.cat.toLowerCase(), ra = req.params.ra, dec = req.params.dec, sr = req.params.sr, band = req.params.band, llim = req.params.llim, ulim = req.params.ulim, order = req.params.order, nmax = req.params.nmax, format = req.params.format.toLowerCase();

    // RA must be decimal for USNOB
    if (ra.indexOf('.') == -1) {
        ra = ra + '.0'
    }

    switch (cat) {
        case 'apass':   
            console.log("using APASS catalogue");     
            var WHERECLAUSE_MAG = 'AND ' + band + ' >= ' + req.params.llim + ' and ' + band + ' <= ' + ulim;
            var ORDERBYCLAUSE = ' ORDER BY ' + order
            LIMITCLAUSE = " LIMIT " + nmax;

            conString = "postgres://" + cfg.db_host + ":" + cfg.apass_db_port + "/" + cfg.apass_db_name;
            pg.connect(conString, function(err, client) {
                if(err) {
                    res.send(err);
                    return console.error('error fetching client from pool', err);
                }
                qry = "SELECT id as apassref, radeg as ra, decdeg as dec, raerrasec, decerrasec, nightsobs as nobs, vmag, bmag, gmag, rmag, imag, verr, berr, gerr, rerr, ierr, degrees(coords <-> spoint '(" + ra + "d," + dec + "d)')*3600 as distance FROM stars WHERE (coords @ scircle '<( " + ra + "d," + dec + "d)," + sr + "d>' = true) " + WHERECLAUSE_MAG + ORDERBYCLAUSE + LIMITCLAUSE;
                _pg_execute(client, qry, function(err, result) {
                    client.end();
                    if(err) {
                        res.send(err);
                        return console.error('error running query', err)
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
                                    return console.error('problem converting to csv', err);
                                    res.send(err)
                                }
                                res.header('Content-Type', 'text/html');
                                res.send(csv);
                            });
                            break;
                       default:
                            res.send({'message' : 'format not recognised'});
                            return console.error('erroneous format requested');
                       }
                });
            });
            break;
        case 'usnob':
            console.log("using USNOB catalogue");
            qry_cmd = cfg.root_path + 'bin/' + 'query_usnob';
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
                    res.send({'message' : 'magnitude filter column not recognised'});
                    return console.error('erroneous magnitude filter column requested');
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
                    res.send({'message' : 'order column not recongised'});
                    return console.error('erroneous order column requested');
            }

            qry_params =  ['-R', cfg.root_path + 'usnob', '-c', ra + ' ' + dec, '-r', sr*60., '-m', nmax, '-lm' + band, llim + ',' + ulim, '-s' + order];
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
                                return console.error('problem converting to csv', err);
                                res.send(err)
                            }
                            res.header('Content-Type', 'text/html');
                            res.send(csv);
                        });
                        break;
                    default:
                        res.send({'message' : 'format not recognised'});
                        return console.error('erroneous format requested');
                }
            });
            break;
        default:
            res.send({'message' : 'catalogue not recognised'});
            return console.error('erroneous catalogue requested');
    }
}

function destroy_skycam(req, res, next) {
    console.log("received a destroy_skycam request");
    schema = req.params.schema;

    conString = "postgres://" + cfg.db_host + ":" + cfg.skycam_db_port + "/" + cfg.skycam_db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(err);
            return console.error('error fetching client from pool', err);
        } else {
            _destroy_skycam_drop_schema(schema, res, client, function(){
                client.end();
                res.send(200);
            });
        }
    });
}

function init_skycam(req, res, next) {
    console.log("received an init_skycam request");
    schema = req.params.schema;

    conString = "postgres://" + cfg.db_host + ":" + cfg.skycam_db_port + "/" + cfg.skycam_db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(err);
            return console.error('error fetching client from pool', err);
        } else {
            _init_skycam_make_schema(schema, res, client, function() {
                _init_skycam_make_table_images(schema, res, client, function() {
                    _init_skycam_make_table_matchedUSNOBObjects(schema, res, client, function() {
                        _init_skycam_make_table_matchedAPASSObjects(schema, res, client, function() {
                            _init_skycam_make_table_sources(schema, res, client, function() {
                                _init_skycam_make_index(schema+".images", "img_date", "idx_images_img_date", res, client, function() {
                                    _init_skycam_make_index(schema+".images", "mjd", "idx_images_mjd", res, client, function() {
                                        _init_skycam_make_index(schema+".sources", "mjd", "idx_sources_mjd", res, client, function() {
                                            _init_skycam_make_index(schema+".sources", "inst_mag", "idx_sources_inst_mag", res, client, function() {
                                                _init_skycam_make_spatial_index(schema+".sources", "pos", "idx_sources_pos", res, client, function() {
                                                    _init_skycam_make_index(schema+".matchedUSNOBObjects", "usnobref_int", "idx_matchedUSNOBObjects_usnobref_int", res, client, function() {
                                                        _init_skycam_make_spatial_index(schema+".matchedUSNOBObjects", "pos", "idx_matchedUSNOBObjects_pos", res, client, function() {
                                                             _init_skycam_make_index(schema+".matchedAPASSObjects", "apassref", "idx_matchedAPASSObjects_apassref", res, client, function() {
                                                                _init_skycam_make_spatial_index(schema+".matchedAPASSObjects", "pos", "idx_matchedAPASSObjects_pos", res, client, function() {
                                                                    client.end();
                                                                    res.send(200);
                                                                });
                                                            });
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        }
    });
}

function skycam_images_get_by_filename(req, res, next) {
    console.log("received a skycam_images_get_by_filename request");
    schema_name = req.params.schema;
    filename    = req.params.filename;
    
    conString = "postgres://" + cfg.db_host + ":" + cfg.skycam_db_port + "/" + cfg.skycam_db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(err);
            return console.error('error fetching client from pool', err);
        } else {
            qry = "SELECT * FROM " + schema_name + ".images WHERE FILENAME = '" + filename + "' ORDER BY MJD LIMIT 1";
            _pg_execute(client, qry, function(err, result) {
                client.end();
                if (err) {
                    res.send(err);
                    return console.error('error running query', err)
                } else {
                    res.send(result.rows);
                }
            });            
        }
    });
}

function skycam_images_insert(req, res, next) {
    console.log("received a skycam_images_insert request");
    schema_name = req.params.schema;
    headers      = JSON.parse(req.params.headers);
    
    conString = "postgres://" + cfg.db_host + ":" + cfg.skycam_db_port + "/" + cfg.skycam_db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(err);
            return console.error('error fetching client from pool', err);
        } else {
            qry = "INSERT INTO " + schema_name + ".images( \
                img_date, img_rundate, mjd, utstart, ra_cent, dec_cent, ra_min, ra_max, \
                dec_min, dec_max, ccdstemp, ccdatemp, azdmd, azimuth, altdmd, altitude, \
                rotskypa, filename) VALUES ('" + headers.DATE_OBS + "', NOW(), " + headers.MJD + ", '" 
                + headers.UTSTART + "', " + headers.RA_CENT + ", " + headers.DEC_CENT + ", " + headers.RA_MIN 
                + ", " + headers.RA_MAX + ", " + headers.DEC_MIN + ", " + headers.DEC_MAX + ", " 
                + headers.CCDSTEMP + ", " + headers.CCDATEMP + ", " + headers.AZDMD + ", " + headers.AZIMUTH 
                + ", " + headers.ALTDMD + ", " + headers.ALTITUDE + ", " + headers.ROTSKYPA + ", '" 
                + headers.FILENAME + "')"
            _pg_execute(client, qry, function(err) {
                client.end();
                if (err) {
                    res.send(err);
                    return console.error('error running query', err)
                } else {
                    res.send(200);
                }
            });            
        }
    });
}

function skycam_sources_add_source_to_buffer(req, res, next) {
    console.log("received a skycam_sources_add_source_to_buffer request");
    schema         = req.params.schema;    
    source         = JSON.parse(req.params.source);
    
    if (!(schema in buffer_sources)) {
        buffer_sources[schema] = [];
    }
    
    buffer_sources[schema].push(source);
    res.send(200)
}

function skycam_sources_flush_buffer_to_db(req, res, next) {
    console.log("received a skycam_sources_flush_buffer_to_db request");
    schema         = req.params.schema;  
    
    if (buffer_sources[schema].length == undefined) {
        err = {'message' : 'buffer is empty'}
        res.send(err)
        return err
    }
    
    valuesClause = "";
    buffer_sources[schema].forEach(function(entry) {
        valuesClause += "(" + entry.img_id + ", " + entry.mjd + ", " + entry.ra + ", " + entry.dec + ", " + entry.x 
        + ", " + entry.y + ", " + entry.fluxAuto + ", " + entry.fluxErrAuto + ", " + entry.magAuto + ", " + entry.magErrAuto
        + ", " + entry.background + ", " + entry.isoareaWorld + ", " + entry.SEFlags + ", " + entry.FWHM + ", " 
        + entry.elongation + ", " + entry.ellipticity + ", " + entry.thetaImage + ", " + entry.usnobref + ", " 
        + entry.usnobref.replace("-", "") + ", " + entry.apassref + ", spoint(" + entry.ra*(Math.PI/180) + ", " + entry.dec*(Math.PI/180) + ")),"
    });
    valuesClause = valuesClause.substr(0, valuesClause.length-1)    // get rid of trailing comma
    
    conString = "postgres://" + cfg.db_host + ":" + cfg.skycam_db_port + "/" + cfg.skycam_db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(err);
            return console.error('error fetching client from pool', err);
        } else {
            qry = "INSERT INTO " + schema + ".sources(img_id, mjd, ra, dec, x_pix, y_pix, flux, flux_err,\
            inst_mag, inst_mag_err, background, isoarea_world, seflags, fwhm, elongation, ellipticity,\
            theta_image, usnobref, usnobref_int, apassref, pos) VALUES " + valuesClause
            _pg_execute(client, qry, function(err) {
                client.end();
                if (err) {
                    res.send(err);
                    return console.error('error running query', err)
                } else {
                    res.send(200);
                }
            });            
        }
    });    
    buffer_sources = {};                // clear buffer
}


var server = restify.createServer();
server.use(restify.bodyParser({}));

var buffer_sources = {}

server.get('/scs/:cat/:ra/:dec/:sr/:band/:llim/:ulim/:order/:nmax/:format', scs);
server.post('/skycam/db/:schema', init_skycam);
server.del('/skycam/db/:schema', destroy_skycam);
server.post('/skycam/tables/images/:schema/:headers', skycam_images_insert);
server.get('/skycam/tables/images/:schema/:filename', skycam_images_get_by_filename);
server.put('/skycam/tables/sources/buffer/:schema/:source', skycam_sources_add_source_to_buffer);
server.post('/skycam/tables/sources/buffer/:schema', skycam_sources_flush_buffer_to_db);

server.pre(restify.CORS({
        credentials: true
}));

server.listen(cfg['ws_port'], function() {
	console.log("(ws.js) server running on port " + cfg['ws_port']);
});
