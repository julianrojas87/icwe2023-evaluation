# Install and run Virtuoso

1. Execute the `./start-virtuoso.sh` script from this folder.

# Importing data into Virtuoso

1. Go to Virtuoso conductor: `http://virtuoso_ip_address:8890/conductor` and Login with DBA credentials. Then go to `Database/Interactive SQL` menu option.

2. Register source data folder (the named graph URI parameter is not important here since it is overwritten by the `global.graph` config file created with `start-virtuoso.sh` script):

   ```plsql
   SQL> ld_dir('./data', '%.gz', 'http://example.org')
   ```

3. Check that sources have been registered:

   ```plsql
   SQL> select * from DB.DBA.load_list;
   ```

4. Run data loading process (this may take a while):

   ```plsql
   SQL> rdf_loader_run();
   ```
