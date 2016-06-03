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
        , QueryStream = require('pg-query-stream')
        , JSONStream = require('JSONStream')
	; 

function _pg_execute(client, qry, callback) {
    client.query(qry, function(err, result) {
        qry = qry.replace(/\s\s+/g, ' ');   // merge any instances of whitespace to single character
        if (qry.length < 1024) {
            console.log('executed query', "\"" + qry + "\"");
        } else { 
            console.log('executed query', "\"" + qry.substr(0,2048) + " ...\""); 
        }
        callback(err, result);
    });
}

function _pg_execute_stream(client, qry, callback) {
    var qs = new QueryStream(qry);	    // create a stream for response
    client.query(qs)
    qs.on('end', client.end);
    qry = qry.replace(/\s\s+/g, ' ');   // merge any instances of whitespace to single character
    if (qry.length < 1024) {
        console.log('executed query', "\"" + qry + "\"");
    } else { 
        console.log('executed query', "\"" + qry.substr(0,2048) + " ...\""); 
    }
    callback(qs);
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
            var WHERECLAUSE_MAG = 'AND ' + band + ' >= ' + llim + ' and ' + band + ' <= ' + ulim;
            var ORDERBYCLAUSE   = ' ORDER BY ' + order;
            var LIMITCLAUSE = '';
            if (nmax > 0) {
                LIMITCLAUSE = ' LIMIT ' + nmax;
            }
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
                _pg_execute_stream(client, qry, function(result) {
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
                            res.end(js2xmlparser("sources", result, options));
                            break;
                        case 'json':
                            console.log("sending output as json");
                            res.header('Content-Type', 'application/json');
                            result.pipe(JSONStream.stringify()).pipe(res);
                            break;
                        case 'html':
                            console.log("outputting as html");
                            var transform = {'tag':'tr', 
                                             'html':'<td>${apassref}</td><td>${ra}</td><td>${dec}</td><td>${raerrasec}</td><td>${decerrasec}</td><td>${nobs}</td><td>${vmag}</td><td>${bmag}</td><td>${gmag}</td><td>${rmag}</td><td>${imag}</td><td>${verr}</td><td>${berr}</td><td>${gerr}</td><td>${rerr}</td><td>${ierr}</td><td>${distance}</td>'};
                            html = "<table cellpadding=3><tr><td><b>apassref</b></td><td><b>ra</b></td><td><b>dec</b></td><td><b>raerrasec</b></td><td><b>decerrasec<b/></td><td><b>nobs<b/></td><td><b>vmag</b></td><td><b>bmag</b></td><td><b>gmag</b></td><td><b>rmag</b></td><td><b>imag</b></td><td><b>verr</b></td><td><b>berr</b></td><td><b>gerr</b></td><td><b>rerr</b></td><td><b>ierr</b></td><td><b>distance</b></td></tr>"
                                 + json2html.transform(result.rows, transform) 
                                 + "</table>";
                            res.header('Content-Type', 'text/html');
                            res.end(html);
                            break;
                        case 'csv':
                            console.log("outputting as csv");
                            fields = ['apassref', 'ra', 'dec', 'raerrasec', 'decerrasec', 'nobs', 'vmag', 'bmag', 'gmag', 'rmag', 'imag', 'verr', 'berr', 'gerr', 'rerr', 'ierr', 'distance'];               
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
        case 'skycamt':  
        case 'skycamz':
            console.log("using " + cat + " catalogue");     
            
            var WHERECLAUSE_MAG = 'AND ' + band + ' >= ' + llim + ' and ' + band + ' <= ' + ulim;
            var ORDERBYCLAUSE   = ' ORDER BY ' + order;
            var LIMITCLAUSE = '';
            if (nmax > 0) {
                LIMITCLAUSE = ' LIMIT ' + nmax;
            }

            conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
            pg.connect(conString, function(err, client) {
                if(err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                }
                qry = "SELECT skycamref, xmatch_apassref, xmatch_usnobref, radeg as ra, decdeg as dec, raerrasec, decerrasec, nobs, \
                       xmatch_apass_brcolour, xmatch_usnob_brcolour, xmatch_apass_rollingmeanmag, xmatch_apass_rollingstdevmag, xmatch_usnob_rollingmeanmag, xmatch_usnob_rollingstdevmag, \
                       xmatch_apass_distasec, xmatch_usnob_distasec, xmatch_apass_ntimesswitched, xmatch_usnob_ntimesswitched, \
                       (pos <-> spoint '(" + ra + "d," + dec + "d)')*3600 as distance FROM " + cat + ".catalogue WHERE (pos @ scircle '<( " + ra + "d," + dec 
                       + "d)," + sr + "d>' = true) " + WHERECLAUSE_MAG + ORDERBYCLAUSE + LIMITCLAUSE;
                _pg_execute_stream(client, qry, function(result) {
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
                            console.log("sending output as json");
                            res.header('Content-Type', 'application/json');
                            result.pipe(JSONStream.stringify()).pipe(res);
                            break;
                        case 'html':
                            console.log("outputting as html");
                            var transform = {'tag':'tr', 
                                             'html':'<td>${skycamref}</td><td>${xmatch_apassref}</td><td>${xmatch_usnobref}</td><td>${ra}</td><td>${dec}</td><td>${raerrasec}</td><td>${decerrasec}</td><td>${nobs}</td><td>${xmatch_apass_brcolour}</td><td>${xmatch_usnob_brcolour}</td><td>${xmatch_apass_rollingmeanmag}</td><td>${xmatch_apass_rollingstdevmag}</td><td>${xmatch_usnob_rollingmeanmag}</td><td>${xmatch_usnob_rollingstdevmag}</td><td>${xmatch_apass_distasec}</td><td>${xmatch_usnob_distasec}</td><td>${xmatch_apass_ntimesswitched}</td><td>${xmatch_usnob_ntimesswitched}</td><td>${distance}</td>'};
                            html = "<table cellpadding=3><tr><td><b>skycamref</b></td><td><b>xmatch_apassref</b></td><td><b>xmatch_usnobref</b></td><td><b>ra</b></td><td><b>dec</b></td><td><b>raerrasec</b></td><td><b>decerrasec<b/></td><td><b>nobs<b/></td><td><b>xmatch_apass_brcolour<b/></td><td><b>xmatch_usnob_brcolour<b/></td><td><b>xmatch_apass_rollingmeanmag</b></td><td><b>xmatch_apass_rollingstdevmag</b></td><td><b>xmatch_usnob_rollingmeanmag</b></td><td><b>xmatch_usnob_rollingstdevmag</b></td><td><b>xmatch_apass_distasec</b></td><td><b>xmatch_usnob_distasec</b></td><td><b>xmatch_apass_ntimesswitched</b></td><td><b>xmatch_usnob_ntimesswitched</b></td><td><b>distance</b></td></tr>"
                                 + json2html.transform(result.rows, transform) 
                                 + "</table>";
                            res.header('Content-Type', 'text/html');
                            res.end(html);
                            break;
                        case 'csv':
                            console.log("outputting as csv");
                            fields = ['apassref', 'xmatch_apassref', 'xmatch_usnobref', 'ra', 'dec', 'raerrasec', 'decerrasec', 'nobs', 'xmatch_apass_brcolour', 'xmatch_usnob_brcolour', 'xmatch_apass_rollingmeanmag', 'xmatch_apass_rollingstdevmag', 'xmatch_usnob_rollingmeanmag', 'xmatch_usnob_rollingstdevmag', 'xmatch_apass_distasec', 'xmatch_usnob_distasec', 'xmatch_apass_ntimesswitched', 'xmatch_usnob_ntimesswitched', 'distance'];               
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
                        console.log("sending output as json");
                        res.json(out_json);
                        break;
                    case 'html':
                        console.log("outputting as html");
                        var transform = {'tag':'tr', 
                                         'html':'<td>${usnobref}</td><td>${ra}</td><td>${dec}</td><td>${raerrasec}</td><td>${decerrasec}</td><td>${bmag1}</td><td>${bmag2}</td><td>${rmag1}</td><td>${rmag2}</td><td>${distance}</td>'};
                        html = "<table cellpadding=3><tr><td><b>usnobref</b></td><td><b>ra</b></td><td><b>dec</b></td><td><b>raerrasec</b></td><td><b>decerrasec</b></td><td><b>bmag1<b/></td><td><b>bmag2</b></td><td><b>rmag1</b></td><td><b>rmag2</b></td><td><b>distance</b></td></tr>"
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
            err['catalogues_expected'] = ['apass', 'usnob', 'skycamz', 'skycamt'];
            res.send(400, err);
            console.error(err);
            return false;
    }
    return;
}

// ***********************
// * _catalogue REQUESTS *
// ***********************

function skycam_catalogue_add_source_to_buffer(req, res, next) {
    console.log("received a skycam_catalogue_add_source_to_buffer request");
    uuid = req.context.uuid;
    
    // add requested [uuid] name as key in JSON buffer object if it doesn't exist
    if (!(uuid in buffer_catalogue)) {
        buffer_catalogue[uuid] = [];
    }

    req.body.forEach(function(vals) {      
        // check [vals] is populated with all necessary keys required to ingest into database
        keys = ['skycamref',
                'xmatch_apassref',
                'xmatch_apass_distasec',
                'xmatch_usnobref',
                'xmatch_usnob_distasec',
                'firstobs_date',
                'lastobs_date',
                'radeg',
                'decdeg', 
                'raerrasec', 
                'decerrasec', 
                'nobs',
                'xmatch_apass_brcolour',
                'xmatch_usnob_brcolour',            
                'xmatch_apass_rollingmeanmag',
                'xmatch_apass_rollingstdevmag',
                'xmatch_usnob_rollingmeanmag',
                'xmatch_usnob_rollingstdevmag',
                'xmatch_apass_ntimesswitched',
                'xmatch_usnob_ntimesswitched'
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
        buffer_catalogue[uuid].push(vals);
    });
    
    res.send(200);
    return;
}

function skycam_catalogue_delete_buffer(req, res, next) {
    console.log("received a skycam_catalogue_delete_buffer request");
    uuid  = req.params.uuid;  
    
    if (buffer_catalogue[uuid] == undefined) {
        err = {'message' : 'uuid doesn\'t exist in buffer or buffer is empty'};
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    delete buffer_catalogue[uuid];
    res.send(200);
    return;
}

function skycam_catalogue_flush_buffer_to_db(req, res, next) {
    console.log("received a skycam_catalogue_flush_buffer_to_db request");
    schema = req.params.schema; 
    uuid = req.params.uuid

    if (buffer_catalogue[uuid] == undefined) {
        err = {'message' : 'uuid doesn\'t exist in buffer or buffer is empty'};
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    // construct a statement for bulk insertion
    valuesClause = "";
    buffer_catalogue[uuid].forEach(function(entry) {
        valuesClause += "('" + entry.skycamref + "', " + entry.xmatch_apassref + ", " + entry.xmatch_apass_distasec + 
            ", '" + entry.xmatch_usnobref + "', " + entry.xmatch_usnob_distasec + ", '" + entry.firstobs_date + "', '" + entry.lastobs_date + "', " + entry.radeg + ", " + entry.decdeg + ", " + 
            entry.raerrasec + ", " + entry.decerrasec + ", " + entry.nobs + ", " + entry.xmatch_apass_brcolour + ", " + entry.xmatch_usnob_brcolour + ", "+ entry.xmatch_apass_rollingmeanmag + ", " + entry.xmatch_apass_rollingstdevmag + ", " + entry.xmatch_usnob_rollingmeanmag + ", " + entry.xmatch_usnob_rollingstdevmag + ", " + entry.xmatch_apass_ntimesswitched + ", " + entry.xmatch_usnob_ntimesswitched + ", spoint(" + entry.radeg*(Math.PI/180) + ", " + entry.decdeg*(Math.PI/180) + ")),";
    });

    valuesClause = valuesClause.substr(0, valuesClause.length-1)    // discard trailing comma
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "INSERT INTO " + schema + ".catalogue(skycamref, xmatch_apassref, xmatch_apass_distasec, xmatch_usnobref, xmatch_usnob_distasec, \
            firstobs_date, lastobs_date, radeg, decdeg, raerrasec, decerrasec, nobs, xmatch_apass_brcolour, xmatch_usnob_brcolour, xmatch_apass_rollingmeanmag, xmatch_apass_rollingstdevmag, \
            xmatch_usnob_rollingmeanmag, xmatch_usnob_rollingstdevmag, xmatch_apass_ntimesswitched, xmatch_usnob_ntimesswitched, pos) VALUES " + valuesClause + " ON CONFLICT \
            (skycamref) DO UPDATE SET xmatch_apassref=excluded.xmatch_apassref, xmatch_apass_distasec=excluded.xmatch_apass_distasec, xmatch_usnobref=excluded.xmatch_usnobref, xmatch_usnob_distasec=excluded.xmatch_usnob_distasec, lastobs_date=excluded.lastobs_date, radeg=excluded.radeg, decdeg=excluded.decdeg, raerrasec=excluded.raerrasec, decerrasec=excluded.decerrasec, nobs=excluded.nobs, xmatch_apass_brcolour=excluded.xmatch_apass_brcolour, xmatch_usnob_brcolour=excluded.xmatch_usnob_brcolour, xmatch_apass_rollingmeanmag=excluded.xmatch_apass_rollingmeanmag, xmatch_apass_rollingstdevmag=excluded.xmatch_apass_rollingstdevmag, xmatch_usnob_rollingmeanmag=excluded.xmatch_usnob_rollingmeanmag, xmatch_usnob_rollingstdevmag=excluded.xmatch_usnob_rollingstdevmag, xmatch_apass_ntimesswitched=excluded.xmatch_apass_ntimesswitched, xmatch_usnob_ntimesswitched=excluded.xmatch_usnob_ntimesswitched, pos=spoint(excluded.radeg*(PI()/180), excluded.decdeg*(PI()/180))";
            _pg_execute(client, qry, function(err, result) {
                client.end();
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    delete buffer_catalogue[uuid];    // sometimes this can clear an UPSERT error (code 21000)
                    return false;
                } else {
                    res.send(200);
                    delete buffer_catalogue[uuid];    // complete flushing process by emptying buffer
                }
                return;
            });            
        }
    });    
}

function skycam_catalogue_get_buffer(req, res, next) {
    console.log("received a skycam_catalogue_get_buffer request");
    res.send(buffer_catalogue);
}

function skycam_catalogue_get_by_skycamref(req, res, next) {
    console.log("received a skycam_catalogue_get_by_skycamref request");
    schema_name = req.params.schema;
    skycamref   = req.params.skycamref;
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "SELECT * FROM " + schema_name + ".catalogue WHERE skycamref = " + skycamref;
            _pg_execute(client, qry, function(err, result) {
                client.end(); 
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    return false;
                } else if (result.rows.length == 0) {
                    err = {'message' : 'no sources with this skycamref found'};
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

function skycam_catalogue_insert(req, res, next) {
    console.log("received a skycam_catalogue_insert request");
    schema = req.params.schema;  
    
    req.body.forEach(function(vals) { 
        // check [vals] is populated with all necessary keys required to ingest into database
        keys = ['skycamref',
                'xmatch_apassref',
                'xmatch_apass_distasec',
                'xmatch_usnobref',
                'xmatch_usnob_distasec',
                'firstobs_date',
                'lastobs_date',
                'radeg',
                'decdeg', 
                'raerrasec', 
                'decerrasec', 
                'nobs',
                'xmatch_apass_brcolour',
                'xmatch_usnob_brcolour',  
                'xmatch_apass_rollingmeanmag',
                'xmatch_apass_rollingstdevmag',
                'xmatch_usnob_rollingmeanmag',
                'xmatch_usnob_rollingstdevmag',
                'xmatch_apass_ntimesswitched',
                'xmatch_usnob_ntimesswitched'
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
    });
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "INSERT INTO " + schema + ".catalogue(skycamref, xmatch_apassref, xmatch_apass_distasec, xmatch_usnobref, xmatch_usnob_distasec, \
            firstobs_date, lastobs_date, radeg, decdeg, raerrasec, decerrasec, nobs, xmatch_apass_brcolour, xmatch_usnob_brcolour, xmatch_apass_rollingmeanmag, xmatch_apass_rollingstdevmag, \ xmatch_usnob_rollingmeanmag, xmatch_usnob_rollingstdevmag, xmatch_apass_ntimesswitched, xmatch_usnob_ntimesswitched, pos) VALUES " + "('" + vals.skycamref + "', " + 
            vals.xmatch_apassref + ", " + vals.xmatch_apass_distasec + ", '" + vals.xmatch_usnobref + "', " + vals.xmatch_usnob_distasec + ", '" + vals.firstobs_date + "', '" + vals.lastobs_date + "', " + vals.radeg + ", " + vals.decdeg + ", " + vals.raerrasec + ", " + vals.decerrasec + ", " + vals.nobs + ", " + vals.xmatch_apass_brcolour + ", " + vals.xmatch_usnob_brcolour + ", " + vals.xmatch_apass_rollingmeanmag + ", " + vals.xmatch_apass_rollingstdevmag + ", " + vals.xmatch_usnob_rollingmeanmag + ", " + vals.xmatch_usnob_rollingstdevmag + ", " + vals.xmatch_apass_ntimesswitched + ", " + vals.xmatch_usnob_ntimesswitched + ", spoint(" + vals.radeg*(Math.PI/180) + ", " + vals.decdeg*(Math.PI/180) + "))";
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

// ********************
// * _images REQUESTS *
// ********************

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

function skycam_images_get_by_filename(req, res, next) {
    console.log("received a skycam_images_get_by_filename request");
    schema_name = req.params.schema;
    filename    = req.params.filename;
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "SELECT count(*) FROM " + schema_name + ".images WHERE filename = '" + filename + "'";
            _pg_execute(client, qry, function(err, result) {
                client.end(); 
                if (err) {
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
    vals        = req.body; 

    // check [vals] is populated with all necessary keys required to ingest into database
    keys = ['IMG_ID',
            'DATE_OBS',
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
    
    // now deal also with optional keys
    keys_opt = ['FRAME_ZP_APASS',
                'FRAME_ZP_STDEV_APASS',
                'FRAME_ZP_USNOB',
                'FRAME_ZP_STDEV_USNOB'
    ];  
    keys_opt.forEach(function(entry) {
        if (!(entry in vals)) {
            vals[entry] = null;
        }
    });
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "INSERT INTO " + schema_name + ".images( img_id, \
                img_date, img_rundate, mjd, utstart, ra_cent, dec_cent, ra_min, ra_max, \
                dec_min, dec_max, ccdstemp, ccdatemp, azdmd, azimuth, altdmd, altitude, \
                rotskypa, frame_zp_apass, frame_zp_stdev_apass, frame_zp_usnob, frame_zp_stdev_usnob, \
                filename) VALUES ('" + vals.IMG_ID + "', '" + decodeURIComponent(vals.DATE_OBS) + "', NOW(), " + vals.MJD + ", '" 
                + decodeURIComponent(vals.UTSTART) + "', " + vals.RA_CENT + ", " + vals.DEC_CENT + ", " + vals.RA_MIN 
                + ", " + vals.RA_MAX + ", " + vals.DEC_MIN + ", " + vals.DEC_MAX + ", " 
                + vals.CCDSTEMP + ", " + vals.CCDATEMP + ", " + vals.AZDMD + ", " + vals.AZIMUTH 
                + ", " + vals.ALTDMD + ", " + vals.ALTITUDE + ", " + vals.ROTSKYPA 
                + ", " + vals.FRAME_ZP_APASS + ", " + vals.FRAME_ZP_STDEV_APASS
                + ", " + vals.FRAME_ZP_USNOB + ", " + vals.FRAME_ZP_STDEV_USNOB 
                + ", '" + vals.FILENAME + "')";
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

// *********************
// * _sources REQUESTS *
// *********************

function skycam_sources_add_source_to_buffer(req, res, next) {
    console.log("received a skycam_sources_add_source_to_buffer request");
    uuid = req.context.uuid;    
    
    // add requested [uuid] name as key in JSON buffer object if it doesn't exist
    if (!(uuid in buffer_sources)) {
        buffer_sources[uuid] = [];
    }
    
    req.body.forEach(function(vals) { 
        // check [vals] is populated with all necessary keys required to ingest into database
        keys = ['img_id',
                'skycamref',
                'mjd', 
                'radeg', 
                'decdeg', 
                'x_pix', 
                'y_pix', 
                'flux', 
                'flux_err', 
                'inst_mag', 
                'inst_mag_err', 
                'background', 
                'isoarea_world', 
                'seflags', 
                'fwhm', 
                'elongation', 
                'ellipticity',
                'theta_image'
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
        
        buffer_sources[uuid].push(vals);
    });
    
    res.send(200);
    return;
}

function skycam_sources_delete_buffer(req, res, next) {
    console.log("received a skycam_sources_delete_buffer request");
    uuid  = req.params.uuid;  
    
    if (buffer_sources[uuid] == undefined) {
        err = {'message' : 'uuid doesn\'t exist in buffer or buffer is empty'};
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    delete buffer_sources[uuid];
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
    uuid = req.params.uuid;
    
    if (buffer_sources[uuid] == undefined) {
        err = {'message' : 'uuid doesn\'t exist in buffer or buffer is empty'};
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    // construct a statement for bulk insertion
    valuesClause = "";
    buffer_sources[uuid].forEach(function(entry) {
        valuesClause += "('" + entry.img_id + "', '" + entry.skycamref + "', " + entry.mjd + ", " + entry.radeg + ", " + entry.decdeg + ", " + entry.x_pix + 
        ", " + entry.y_pix + ", " + entry.flux + ", " + entry.flux_err + ", " + entry.inst_mag + ", " + entry.inst_mag_err + 
        ", " + entry.background + ", " + entry.isoarea_world + ", " + entry.seflags + ", " + entry.fwhm + ", " + 
        entry.elongation + ", " + entry.ellipticity + ", " + entry.theta_image + ", spoint(" + entry.radeg*(Math.PI/180) + 
        ", " + entry.decdeg*(Math.PI/180) + ")),";
    });

    valuesClause = valuesClause.substr(0, valuesClause.length-1)    // discard trailing comma
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "INSERT INTO " + schema + ".sources(img_id, skycamref, mjd, radeg, decdeg, x_pix, y_pix, flux, flux_err,\
            inst_mag, inst_mag_err, background, isoarea_world, seflags, fwhm, elongation, ellipticity,\
            theta_image, pos) VALUES " + valuesClause;
            _pg_execute(client, qry, function(err) {
                client.end();
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    delete buffer_sources[uuid]     // sometimes this can clear an INSERT error (code 21000)
                    return false;
                } else {
                    res.send(200);
                    delete buffer_sources[uuid];    // complete flushing process by emptying buffer
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
    
    req.body.forEach(function(vals) { 
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
    });
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {
            qry = "INSERT INTO " + schema + ".sources(img_id, skycamref, mjd, ra, dec, x_pix, y_pix, flux, flux_err,\
            inst_mag, inst_mag_err, background, isoarea_world, seflags, fwhm, elongation, ellipticity,\
            theta_image, pos) VALUES " + "('" + vals.img_id + "', '" + vals.skycamref + "', " + vals.mjd + ", " + vals.ra + ", " + 
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

// ****************
// * transactions *
// ****************

function skycam_flush_buffers_by_uuid_to_db(req, res, next) {
    console.log("received a skycam_flush_buffers_by_uuid_to_db request");
    schema      = req.params.schema;
    img_id      = req.params.img_id;
    uuid        = req.params.uuid;
    
    if (buffer_catalogue[uuid] == undefined) {
        err = {'message' : 'uuid doesn\'t exist in catalogue buffer or buffer is empty'};
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    // CATALOGUE
    // construct a statement for bulk insertion
    valuesClauseCatalogue = "";
    buffer_catalogue[uuid].forEach(function(entry) {
        valuesClauseCatalogue += "('" + entry.skycamref + "', " + entry.xmatch_apassref + ", " + entry.xmatch_apass_distasec + 
            ", '" + entry.xmatch_usnobref + "', " + entry.xmatch_usnob_distasec + ", '" + decodeURIComponent(entry.firstobs_date) + "', '" + decodeURIComponent(entry.lastobs_date) + "', " + entry.radeg + ", " + entry.decdeg + ", " + entry.raerrasec + ", " + entry.decerrasec + ", " + entry.nobs + ", " + entry.xmatch_apass_brcolour + ", " + entry.xmatch_usnob_brcolour + ", "+ entry.xmatch_apass_rollingmeanmag + ", " + entry.xmatch_apass_rollingstdevmag + ", " + entry.xmatch_usnob_rollingmeanmag + ", " + entry.xmatch_usnob_rollingstdevmag + ", " + entry.xmatch_apass_ntimesswitched + ", " + entry.xmatch_usnob_ntimesswitched + ", spoint(" + entry.radeg*(Math.PI/180) + ", " + entry.decdeg*(Math.PI/180) + ")),";
    });
    valuesClauseCatalogue = valuesClauseCatalogue.substr(0, valuesClauseCatalogue.length-1)    // discard trailing comma
    
    if (buffer_sources[uuid] == undefined) {
        err = {'message' : 'uuid doesn\'t exist in sources buffer or buffer is empty'};
        res.send(400, err);
        console.error(err);
        return false;
    }
    
    // SOURCES
    // construct a statement for bulk insertion
    valuesClauseSources = "";
    buffer_sources[uuid].forEach(function(entry) {
        valuesClauseSources += "('" + entry.img_id + "', '" + entry.skycamref + "', " + entry.mjd + ", " + entry.radeg + ", " + entry.decdeg + ", " + entry.x_pix + 
        ", " + entry.y_pix + ", " + entry.flux + ", " + entry.flux_err + ", " + entry.inst_mag + ", " + entry.inst_mag_err + 
        ", " + entry.background + ", " + entry.isoarea_world + ", " + entry.seflags + ", " + entry.fwhm + ", " + 
        entry.elongation + ", " + entry.ellipticity + ", " + entry.theta_image + ", spoint(" + entry.radeg*(Math.PI/180) + 
        ", " + entry.decdeg*(Math.PI/180) + ")),";
    });
    valuesClauseSources = valuesClauseSources.substr(0, valuesClauseSources.length-1)    // discard trailing comma
    
    conString = "postgres://" + cfg.skycam.db_user + "@" + cfg.skycam.db_host + ":" + cfg.skycam.db_port + "/" + cfg.skycam.db_name;
    pg.connect(conString, function(err, client) {
        if(err) {
            res.send(400, err);
            console.error(err);
            return false;
        } else {           
            qryCatalogue = "INSERT INTO " + schema + ".catalogue(skycamref, xmatch_apassref, xmatch_apass_distasec, xmatch_usnobref, xmatch_usnob_distasec, \
            firstobs_date, lastobs_date, radeg, decdeg, raerrasec, decerrasec, nobs, xmatch_apass_brcolour, xmatch_usnob_brcolour, xmatch_apass_rollingmeanmag, xmatch_apass_rollingstdevmag, \
            xmatch_usnob_rollingmeanmag, xmatch_usnob_rollingstdevmag, xmatch_apass_ntimesswitched, xmatch_usnob_ntimesswitched, pos) VALUES " + valuesClauseCatalogue + " ON CONFLICT \
            (skycamref) DO UPDATE SET xmatch_apassref=excluded.xmatch_apassref, xmatch_apass_distasec=excluded.xmatch_apass_distasec, xmatch_usnobref=excluded.xmatch_usnobref, xmatch_usnob_distasec=excluded.xmatch_usnob_distasec, lastobs_date=excluded.lastobs_date, radeg=excluded.radeg, decdeg=excluded.decdeg, raerrasec=excluded.raerrasec, decerrasec=excluded.decerrasec, nobs=excluded.nobs, xmatch_apass_brcolour=excluded.xmatch_apass_brcolour, xmatch_usnob_brcolour=excluded.xmatch_usnob_brcolour, xmatch_apass_rollingmeanmag=excluded.xmatch_apass_rollingmeanmag, xmatch_apass_rollingstdevmag=excluded.xmatch_apass_rollingstdevmag, xmatch_usnob_rollingmeanmag=excluded.xmatch_usnob_rollingmeanmag, xmatch_usnob_rollingstdevmag=excluded.xmatch_usnob_rollingstdevmag, xmatch_apass_ntimesswitched=excluded.xmatch_apass_ntimesswitched, xmatch_usnob_ntimesswitched=excluded.xmatch_usnob_ntimesswitched, pos=spoint(excluded.radeg*(PI()/180), excluded.decdeg*(PI()/180));";  
            qrySources = "INSERT INTO " + schema + ".sources(img_id, skycamref, mjd, radeg, decdeg, x_pix, y_pix, flux, flux_err,\
            inst_mag, inst_mag_err, background, isoarea_world, seflags, fwhm, elongation, ellipticity,\
            theta_image, pos) VALUES " + valuesClauseSources + ";";
            qryUpdateImages = "UPDATE " + schema + ".images SET has_processed_successfully = true WHERE img_id = '" + img_id + "';";
            
            qry = "BEGIN; " + qryCatalogue + qrySources + qryUpdateImages + "COMMIT;";
            _pg_execute(client, qry, function(err, result) {
                client.end();
                if (err) {
                    res.send(400, err);
                    console.error(err);
                    delete buffer_catalogue[uuid];
                    delete buffer_sources[uuid];
                    return false;
                } else {
                    res.send(200);
                    delete buffer_catalogue[uuid];
                    delete buffer_sources[uuid];
                }
                return;
            });            
        }
    });  
}

var server = restify.createServer();
server.use(restify.bodyParser({}));

server.get('/scs/:cat/:ra/:dec/:sr/:band/:llim/:ulim/:order/:nmax/:format', scs);

server.post('/skycam/tables/images/:schema/', skycam_images_insert);
server.del('/skycam/tables/images/:schema/:img_id', skycam_images_delete_by_img_id);
server.get('/skycam/tables/images/:schema/img_id/:img_id', skycam_images_get_by_img_id);
server.get('/skycam/tables/images/:schema/filename/:filename', skycam_images_get_by_filename);

var buffer_catalogue = {};
server.put('/skycam/tables/catalogue/buffer/:uuid/', skycam_catalogue_add_source_to_buffer);
server.post('/skycam/tables/catalogue/buffer/:schema/:uuid/', skycam_catalogue_flush_buffer_to_db);
server.del('/skycam/tables/catalogue/buffer/:uuid/', skycam_catalogue_delete_buffer);
server.get('/skycam/tables/catalogue/buffer', skycam_catalogue_get_buffer);

server.get('/skycam/tables/catalogue/:schema/:skycamref', skycam_catalogue_get_by_skycamref);
server.post('/skycam/tables/catalogue/:schema/', skycam_catalogue_insert);
    
var buffer_sources = {};
server.put('/skycam/tables/sources/buffer/:uuid/', skycam_sources_add_source_to_buffer);
server.post('/skycam/tables/sources/buffer/:schema/:uuid/', skycam_sources_flush_buffer_to_db);
server.del('/skycam/tables/sources/buffer/:uuid/', skycam_sources_delete_buffer);
server.get('/skycam/tables/sources/buffer', skycam_sources_get_buffer);

server.post('/skycam/tables/sources/:schema/', skycam_sources_insert);
server.del('/skycam/tables/sources/:schema/:img_id', skycam_sources_delete_by_img_id);
server.get('/skycam/tables/sources/:schema/:img_id', skycam_sources_get_by_img_id);

server.post('/skycam/transactions/flush/:schema/:img_id/:uuid', skycam_flush_buffers_by_uuid_to_db);

server.pre(restify.CORS({
        credentials: true
}));

server.listen(cfg['ws_port'], function() {
	console.log("(ws.js) server running on port " + cfg['ws_port']);
});
