#!/bin/bash

# Set up GraphDB and download data
if [ ! -f server/graphdb-10.1.3-dist.zip ]
then
    cd server
    wget -O graphdb-10.1.3-dist.zip https://cloud.ilabt.imec.be/index.php/s/asntXpy27AANJMx/download/graphdb-10.1.3-dist.zip
    cd ..
fi

if [ ! -f data/graphdb-import/era-kg-v2.5.0.nq.gz ]
then
    mkdir data
    mkdir data/graphdb-import
    cd data/graphdb-import
    wget -O era-kg-v2.5.0.nq.gz https://cloud.ilabt.imec.be/index.php/s/5WX8wpCf7T4KjyF/download/era-kg-v2.5.0.nq.gz
    cd ../..
fi

# Start GraphDB Docker container
sudo docker-compose up -d