catalogue-webservices
=============

# Overview

Supported catalogues must be installed. See "Catalogue Installation" section for 
more details.

The root path to the catalogue directory must be set in config.json. This is 
`/cat/` by default, and has a structure like:

>[eng@catalogue cat]$ ls  
> apass  bin  src  usnob   skycam

where:

* `bin` is a symlink to the directory containing the query_usnob executable.
* `src` is a symlink to the directory containing the usnob1 C code (optional if you've already compiled)
* `usnob` is a symlink to the directory containing the USNOB binary files.
* `apass` is a symlink to the directory containing the APASS database.
* `skycam` is a symlink to the directory containing the SKYCAM database.

# Catalogues supported

* APASS
* USNOB
* SKYCAM (output)

# Available Calls

These services are available by issuing a GET request to http://150.204.240.115:3000.

#### Simple Cone Searches

Syntax:

/scs/[CATALOGUE]/[RA]/[DEC]/[SR]/[MAGNITUDE\_FILTER\_COLUMN]/[BRIGHT\_MAG\_LIMIT]/[FAINT\_MAG\_LIMIT]/[ORDER\_BY\_COLUMN]/[MAX\_RETURNED\_ROWS]/[OUTPUT\_FORMAT]

e.g.

`http://150.204.240.115:3000/scs/usnob/45/15/2.0/rmag1/5/15/rmag1/1000/html`

Notes:

- Possible values of CATALOGUE include "usnob", "apass" and "skycam".
- RA/DEC/SR are in degrees.
- MAGNITUDE\_FILTER\_COLUMN can be any magnitude related column.
- ORDER\_BY\_COLUMN can be any output column (except usnobref, raerrasec, decerrasec in USNOB queries).
- MAX\_RETURNED\_ROWS shouldn't be too large for a large search radius!
- OUTPUT\_FORMAT can be json, xml, html or csv.

# Catalogue Installation

### APASS

#### a recipe for ingesting an APASS database

* install postgres:

`sudo yum install postgres postgres-server postgresql-devel pgadmin3`

* initialise postgres:

`initdb -D /some/path`

* change lockfile permissions:

`sudo chmod o+w /var/run/postgresql/`

* start postgres server:

`postgres -D /same/path/as/before`

* create database:

`createdb apass`

* install postgis:

`sudo yum install postgis`

* download pgSphere [source](http://pgfoundry.org/frs/?group_id=1000240&release_id=1577#pgsphere-_1.1.1-title-content):

* install pgSphere:

`make USE_PGXS=1`
`sudo make install USE_PGXS=1`

* edit resulting .sql (/usr/share/pgsql/contrib/pg_sphere.sql) file that is 
used to load the functions. Change instances of LANGUAGE 'C' to LANGUAGE 'c' 
(i.e. lowercase). Change instances of LANGUAGE 'SQL' to LANGUAGE 'sql' 
(i.e. lowercase)

* load functions into database

`psql apass < /usr/share/pgsql/contrib/pg_sphere.sql`

* after adding pgsphere support, create table "stars":

`psql: create table stars(id bigserial primary key not null, name text not   
null, RADeg real not null, RAErrAsec real not null, DECDeg real not null,  
DECErrAsec real not null, NightsObs integer not null, ImagesObs integer not   
null, Vmag real not null, BVmag real not null, Bmag real not null, Gmag real   
not null, Rmag real not null, Imag real not null, Verr real not null, BVerr   
real not null, Berr real not null, Gerr real not null, Rerr real not null,   
Ierr real not null, coords spoint);`  

* ingest data into postgres server. This depends on how the data is presented. 
Generally, it is a series of ascii files. These must be merged, removing the 
header tokens (#). After this, a copy command can be run:

`COPY stars (name, radeg, raerrasec, decdeg, decerrasec, nightsobs, imagesobs, vmag,
 bvmag, bmag, gmag, rmag, imag, verr, bverr, berr, gerr, rerr, ierr) FROM '/path/to/some/merged/file'`

* update coords field with pgSphere spoint type:

`UPDATE stars SET coords = spoint(radians(radeg), radians(decdeg));`

* (optional) add a spherical index on this field:

`CREATE INDEX stars_coords ON stars USING GIST(coords);`

* (optional) cluster on this index

`CLUSTER stars_coords ON stars;`

#### setting access rights

Remote access must be allowed from the postgres configs.

* edit postgresql.conf and add '*' to listen_addresses, unless you have a 
specific IP you want to listen for, in which case use that. This file also
contains information on the port used.

* to allow a user access, edit pg_hba.conf and add a line like:

> host	all	{USER}	{IP}	{GATEWAY}	trust

### USNOB

The USNOB catalogue is currently stored as a series of directories. A binary 
file, "query_usnob", must be compiled in order to use this catalogue for 
source cross-matching. 

The structure is like:

`[eng@catalogue usnob]$ pwd`

> /home/eng/cat/usnob

`[eng@catalogue usnob]$ ls`

> 000  012  024  036  048  060  072  084  096  108  120  132  144  156  168  
> 001  013  025  037  049  061  073  085  097  109  121  133  145  157  169  
> 002  014  026  038  050  062  074  086  098  110  122  134  146  158  170  
> 003  015  027  039  051  063  075  087  099  111  123  135  147  159  171  
> 004  016  028  040  052  064  076  088  100  112  124  136  148  160  172  
> 005  017  029  041  053  065  077  089  101  113  125  137  149  161  173  
> 006  018  030  042  054  066  078  090  102  114  126  138  150  162  174  
> 007  019  031  043  055  067  079  091  103  115  127  139  151  163  175  
> 008  020  032  044  056  068  080  092  104  116  128  140  152  164  176  
> 009  021  033  045  057  069  081  093  105  117  129  141  153  165  177  
> 010  022  034  046  058  070  082  094  106  118  130  142  154  166  178  
> 011  023  035  047  059  071  083  095  107  119  131  143  155  167  179  

### SKYCAM

#### hosting your own local copy

Assuming you have access to a copy of the database, ensure you have a 
directory structure like, e.g.

`[eng@catalogue skycam]$ pwd`

> /home/eng/cat/skycam

`[eng@catalogue skycam]$ ls`

> base         pg\_ident.conf  pg\_serial     pg\_tblspc    postgresql.conf  
> global       pg\_log         pg\_snapshots  pg\_twophase  postmaster.opts  
> pg\_clog      pg\_multixact   pg\_stat_tmp   PG\_VERSION   postmaster.pid  
> pg\_hba.conf  pg\_notify      pg\_subtrans   pg\_xlog  

The command to then start the postgres daemon (running on port 5433) is:

`[eng@catalogue skycam]$ pwd`

> /home/eng/cat/

`[eng@catalogue cat]$ postgres -p 5433 -D skycam/`

You will need to make sure to specify a different port number if you're already 
running a postgres database for APASS on the default port (5432). This must be 
reflected in config.json.

#### setting access rights

Remote access must be allowed from the postgres configs.

* edit postgresql.conf and add '*' to listen_addresses, unless you have a 
specific IP you want to listen for, in which case use that. This file also
contains information on the port used.

* to allow a user access, edit pg_hba.conf and add a line like:

> host  all     {USER}     {IP}    {GATEWAY}       trust


