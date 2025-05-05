#!/bin/bash

# First argument will be the contents of $USE_ANYTRUST
useAnytrust=$1

if [ $useAnytrust = "true" ]
then
    # Start daserver loading the configuration file
    /usr/local/bin/daserver --conf.file /home/user/.arbitrum/das-config.json
else
    echo "Running chain in Rollup mode, no need for das-server."
    exit
fi
