# Install and run Stardog

1. Execute the `./start-stardog.sh` script from this folder.

# Importing data into Stardog

1. Execute the following command to load the ERA KG into a running Stardog instance:

    ```bash
    sudo docker exec -it stardog /opt/stardog/bin/stardog-admin db create -n ERA-KG @http://data.europa.eu/949/graph/rinf /home/era-kg_04-02-2023.nt.gz
    ```
