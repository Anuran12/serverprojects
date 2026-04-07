Generate the MD5 password for pgBouncer userlist:

- Format: md5(password + username)
- Example (PowerShell):
  $input = "$env:PGBOUNCER_PASSWORD$env:PGBOUNCER_USER"; ...

Create db/pgbouncer/userlist.txt with:
"<user>" "md5<hash>"

Then restart pgbouncer.
