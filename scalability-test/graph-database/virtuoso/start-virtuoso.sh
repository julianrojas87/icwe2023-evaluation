#!/bin/bash

# Download ERA KG
if [ ! -f server/graphdb-10.1.3-dist.zip ]
then
    mkdir data
    cd data
    wget -O era-kg_04-02-2023.nt.gz https://cloud.ilabt.imec.be/index.php/s/BMa4rdDoE4jKMq2/download/era-kg_04-02-2023.nt.gz
    echo "http://data.europa.eu/949/graph/rinf" > global.graph
    cd ..
fi

# Start Virtuoso Docker container
sudo docker pull openlink/virtuoso-closedsource-8
sudo docker run --name virtuoso --env DBA_PASSWORD=dba -p 1111:1111 -p 8890:8890 -v `pwd`:/database -d openlink/virtuoso-closedsource-8:latest