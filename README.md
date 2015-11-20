catalogue-webservices
=============

# Overview

Supported catalogues must be installed first. See "Catalogue Installation" section for 
more details.

In order to use the USNOB catalogue, the root path to the catalogue directory (containing the 
usnob binary and catalogue binaries) must be set in config.json. This is  `/cat/` by default, 
and has a structure like:

>[eng@catalogue cat]$ ls  
> apass  bin  src  usnob   skycam

where:

* `bin` is the directory containing the query_usnob executable.
* `src` is the directory containing the usnob1 C code (optional if you've already compiled)
* `usnob` is the directory containing the USNOB binary files.
* `apass` is the directory containing the APASS database.
* `skycam` is the directory containing the SKYCAM database.

Equivalently, to use the APASS and Skycam catalogues, the database parameters (db_\* and *_db_\*)
must be set accordingly in config.json. These databases are not password protected.

# Catalogues supported

* APASS
* USNOB
* Skycam

# Available Webservices


### Catalogue Queries


#### 1. Simple Cone Search (APASS, USNOB and Skycam)

**HTTP Method**: GET

**Syntax**:

/scs/[CATALOGUE]/[RA]/[DEC]/[SR]/[MAGNITUDE\_FILTER\_COLUMN]/[BRIGHT\_MAG\_LIMIT]/
[FAINT\_MAG\_LIMIT]/[ORDER\_BY\_COLUMN]/[MAX\_RETURNED\_ROWS]/[OUTPUT\_FORMAT]

e.g.

`http://localhost:3000/scs/apass/45/15/2.0/rmag/5/15/rmag/1000/html`

**Returns**

A list of targets satisfying the above criteria in either JSON, XML, HTML or CSV format.

**Notes**:

- Possible values of CATALOGUE include "usnob", "apass" and "skycam".
- RA/DEC/SR are in degrees.
- MAGNITUDE\_FILTER\_COLUMN can be any magnitude related column.
- ORDER\_BY\_COLUMN can be any output column (except usnobref, raerrasec, decerrasec in USNOB queries).
- MAX\_RETURNED\_ROWS shouldn't be too large for a large search radius!
- OUTPUT\_FORMAT can be JSON, XML, HTML or CSV.

***

There are two ways to insert sources into the Skycam database. The first is non-buffered, adding a single source at a time (non-buffered). The second uses an internal buffer (buffered). For the latter, the sequence of HTTP requests is PUT then POST.

#### 2. Insert Image (Skycam only)

**HTTP Method**: POST

**Syntax**:

/skycam/tables/images/[SCHEMA_NAME]/[VALUES]

e.g. 

`http://localhost:3000/skycam/tables/images/skycamz/{"MJD": "56453.9897685", "AZDMD": 131.3999, "ALTDMD": 66.3945, "DATE_OBS": "2013-06-10T23%3A45%3A16", "RA_MAX": 256.891, "UTSTART": "23%3A45%3A16", "RA_MIN": 255.443, "ALTITUDE": 66.3945, "RA_CENT": 256.16746413, "CCDATEMP": -40, "FILENAME": "z_e_20130610_210_1_1_1.fits", "CCDSTEMP": -40, "DEC_MAX": 13.4933, "AZIMUTH": 131.3999, "DEC_MIN": 12.082, "DEC_CENT": 12.788429216, "ROTSKYPA": -34.650148}`

**Returns**

A JSON object with populated `img_id` and `mjd` fields.

**Notes**:

- [VALUES] is a JSON object. Keys required are listed by calling the webservice with an empty ({}) [VALUES] object.

#### 3. Insert Non-Buffered Source (Skycam only)

**HTTP Method**: POST

**Syntax**: 

/skycam/tables/sources/[SCHEMA_NAME]/[VALUES]

e.g. 

`http://localhost:3000/skycam/tables/sources/skycamz/{"mjd": 56453.9897685, "isoareaWorld": 0.00004097222, "magAuto": -8.8641, "ellipticity": 0.291, "img_id": "1", "SEFlags": 0,   "fluxAuto": 3512.75, "thetaImage": -14.71, "fluxErrAuto": 38.48057, "ra": 256.7084284141811, "background": 29.62897, "y": 18.0246, "x": 818.6285, "FWHM": 0.004684697, "dec": 12.557316425224261, "elongation": 1.411, "magErrAuto": 0.0119, "skycamref" : 1}`

**Notes**:

- [VALUES] is a JSON object. Keys required are listed by calling the webservice with an empty ({}) [VALUES] object.

#### 4. Add Source to Internal Buffer (Skycam only)

**HTTP Method**: PUT

**Syntax**: 

/skycam/tables/sources/buffer/[SCHEMA_NAME]/[VALUES]

e.g.

`http://localhost:3000/skycam/tables/sources/buffer/skycamz/{"mjd": 56453.9897685, "isoareaWorld": 4.097222e-05, "magAuto": -8.8641, "ellipticity": 0.291, "img_id": "1", "SEFlags": 0.0, "fluxAuto": 3512.75, "thetaImage": -14.71, "fluxErrAuto": 38.48057, "ra": 256.7084284141811, "background": 29.62897, "y": 18.0246, "x": 818.6285, "FWHM": 0.004684697, "dec": 12.557316425224261, "elongation": 1.411, "magErrAuto": 0.0119, "skycamref" : 1}`

**Notes**:

- [VALUES] is a JSON object. Keys required are listed by calling the webservice with an empty ({}) [VALUES] object.

#### 5. Flush Buffer to Database (Skycam only)

**HTTP Method**: POST

**Syntax**: 

/skycam/tables/sources/buffer/[SCHEMA_NAME]

e.g.

`http://localhost:3000/skycam/tables/sources/buffer/skycamz`

#### 6. Get Buffer (Skycam only)

**HTTP Method**: GET

**Syntax**: 

/skycam/tables/sources/buffer

e.g.

`http://localhost:3000/skycam/tables/sources/buffer`

#### 7. Delete Buffer (Skycam only)

**HTTP Method**: DELETE

**Syntax**: 

/skycam/tables/sources/buffer/[SCHEMA_NAME]

e.g.

`http://localhost:3000/skycam/tables/sources/buffer/skycamz`

# Catalogue Installation

### APASS

#### a recipe for ingesting an APASS database

* install postgres:

`sudo yum install postgres postgresql-server postgresql-devel pgadmin3`

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

If you get an "unknown type name `int4`, then you will need to edit 
line.h and add the following:

`typedef int16 int4;`

* edit resulting .sql (/usr/share/pgsql/contrib/pg_sphere.sql) file that is 
used to load the functions. Change instances of LANGUAGE 'C' to LANGUAGE 'c' 
(i.e. lowercase). Change instances of LANGUAGE 'SQL' to LANGUAGE 'sql' 
(i.e. lowercase)

* load functions into database

`psql apass < /usr/share/pgsql/contrib/pg_sphere.sql`

* (UPGRADING POSTGRESQL)

Use the pg_upgrade command. This will initially fail due to not having a 
compatible version of pgsphere. This will need to be recompiled. The above
should work, but a more recent method is the following.

Obtaining the most recent version from the postgres yum repo. You will need 
both the server and packages. Clone the pgsphere github: 
https://github.com/mnullmei/pgsphere.git. Before compiling, you will 
need to symlink/usr/include/pgsql to point to the upgraded version's headers 
(e.g. /usr/pgsql-9.5/include/). The resulting pg_sphere.so will need to be 
put in the upgraded version's lib folder (e.g. /usr/pgsql-9.5/lib/).

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

#### building the USNOB query binary
 
This can be done from the /cat/src/ folder with:

`make usnob`

### Skycam

It is preferable to copy over an existing database structure. The following does
not discuss table layout; internal DDL functions (_init*) are used to initialise 
the database structure. These DDL functions can be found in this distribution.

#### creating the database

* initialise postgres:

`initdb -D /some/path`

* ensure the directory structure is correct

`[eng@catalogue skycam]$ pwd`

> /home/eng/cat/skycam

`[eng@catalogue skycam]$ ls`

> base         pg\_ident.conf  pg\_serial     pg\_tblspc    postgresql.conf  
> global       pg\_log         pg\_snapshots  pg\_twophase  postmaster.opts  
> pg\_clog      pg\_multixact   pg\_stat_tmp   PG\_VERSION   postmaster.pid  
> pg\_hba.conf  pg\_notify      pg\_subtrans   pg\_xlog  

* start the postgres daemon (running on port 5433) is:

`[eng@catalogue skycam]$ pwd`

> /home/eng/cat/

`[eng@catalogue cat]$ postgres -p 5433 -D skycam/`

You will need to make sure to specify a different port number if you're already 
running a postgres database for APASS on the default port (5432). This must be 
reflected in config.json.

* create skycam database

`createdb --port 5433 skycam`

* add pgSphere support. This is discussed in the section "a recipe for ingesting 
an APASS database".

#### setting access rights

Remote access must be allowed from the postgres configs.

* edit postgresql.conf and add '*' to listen_addresses, unless you have a 
specific IP you want to listen for, in which case use that. This file also
contains information on the port used.

* to allow a user access, edit pg_hba.conf and add a line like:

> host  all     {USER}     {IP}    {GATEWAY}       trust


