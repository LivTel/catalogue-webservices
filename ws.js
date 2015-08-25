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

function slice_usnob_str(s) {
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
       
// EXPOSED WEB SERVICES
     
/*function index(req, res, next) { 
  fs.readFile('html/index.htm', {encoding : "UTF-8"}, function (err, html) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(html);  
  });
}*/

function scs(req, res, next) {
    console.log("received an scs request");
    cat = req.params.cat.toLowerCase(), ra = req.params.ra, dec = req.params.dec, sr = req.params.sr, band = req.params.band, llim = req.params.llim, ulim = req.params.ulim, order = req.params.order, nmax = req.params.nmax, format = req.params.format.toLowerCase();
    switch (cat) {
        case 'apass':   
            console.log("using APASS catalogue");     
            var WHERECLAUSE_MAG = 'AND ' + band + ' >= ' + req.params.llim + ' and ' + band + ' <= ' + ulim;
            var ORDERBYCLAUSE = ' ORDER BY ' + order
            LIMITCLAUSE = " LIMIT " + nmax;

            conString = "postgres://" + cfg.db_host + ":" + cfg.db_port + "/" + cfg.db_name;
            pg.connect(conString, function(err, client, done) {
                if(err) {
                    res.send(err);
                    return console.error('error fetching client from pool', err);
                }
                qry = "SELECT id as apassref, radeg as ra, decdeg as dec, raerrasec, decerrasec, nightsobs as nobs, vmag, bmag, gmag, rmag, imag, verr, berr, gerr, rerr, ierr, degrees(coords <-> spoint '(" + ra + "d," + dec + "d)')*3600 as distance FROM stars WHERE (coords @ scircle '<( " + ra + "d," + dec + "d)," + sr + "d>' = true) " + WHERECLAUSE_MAG + ORDERBYCLAUSE + LIMITCLAUSE;
                client.query(qry, function(err, result) {
                    console.log('executing query: ' + qry);
                    done();
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

            qry_params =  ['-R', cfg.root_path + 'usnob', '-c', ra + ',' + dec, '-r', sr*60., '-m', nmax, '-lm' + band, llim + ',' + ulim, '-s' + order];
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
                    out_json.push(slice_usnob_str(value));
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

var server = restify.createServer();
server.use(restify.bodyParser())

//server.get('/', index);
server.get('/scs/:cat/:ra/:dec/:sr/:band/:llim/:ulim/:order/:nmax/:format', scs);

server.pre(restify.CORS({
        credentials: true
}));

server.listen(cfg['ws_port'], function() {
	console.log("(ws.js) server running on port " + cfg['ws_port']);
});
