#!/bin/bash

# Download ERA KG
if [ ! -f data/era-kg-v2.5.0.nq.gz ]
then
    mkdir data
    cd data
    wget -O era-kg-v2.5.0.nq.gz https://cloud.ilabt.imec.be/index.php/s/5WX8wpCf7T4KjyF/download/era-kg-v2.5.0.nq.gz
    echo "http://data.europa.eu/949/graph/rinf" > global.graph
    cd ..
fi

# Start Virtuoso Docker container
sudo docker pull openlink/virtuoso-opensource-7
sudo docker run --name virtuoso-os --env DBA_PASSWORD=dba -p 1112:1111 -p 8891:8890 -v `pwd`:/database openlink/virtuoso-opensource-7:latest