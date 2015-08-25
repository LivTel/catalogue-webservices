catalogue-webservices
=============

# Available Calls

These services are available by issuing a GET request to http://150.204.240.115:3000.

## Simple Cone Searches

Syntax:

/scs/[CATALOGUE]/[RA]/[DEC]/[SR]/[MAGNITUDE\_FILTER\_COLUMN]/[BRIGHT\_MAG\_LIMIT]/[FAINT\_MAG\_LIMIT]/[ORDER\_BY\_COLUMN]/[MAX\_RETURNED\_ROWS]/[OUTPUT\_FORMAT]

e.g.

`http://150.204.240.115:3000/scs/usnob/45/15/2.0/rmag1/5/15/rmag1/1000/html`

- Possible values of CATALOGUE include "usnob" and "apass".
- RA/DEC/SR are in degrees.
- MAGNITUDE\_FILTER\_COLUMN can be any magnitude related column.
- ORDER\_BY\_COLUMN can be any output column (except usnobref, raerrasec, decerrasec in USNOB queries).
- MAX\_RETURNED\_ROWS shouldn't be too large for a large search radius!
- OUTPUT\_FORMAT can be json, xml, html or csv.




