#!/bin/bash

# Set up GraphDB and download data
if [ ! -f server/graphdb-10.1.3-dist.zip ]
then
    cd server
    wget -O graphdb-10.1.3-dist.zip https://cloud.ilabt.imec.be/index.php/s/asntXpy27AANJMx/download/graphdb-10.1.3-dist.zip
    cd ..
fi

if [ ! -f data/graphdb-import/era-kg_04-02-2023.nt.gz ]
then
    mkdir data
    mkdir data/graphdb-import
    cd data/graphdb-import
    wget -O era-kg_04-02-2023.nt.gz https://cloud.ilabt.imec.be/index.php/s/BMa4rdDoE4jKMq2/download/era-kg_04-02-2023.nt.gz
    cd ../..
fi

# Start GraphDB Docker container
sudo docker-compose up -d