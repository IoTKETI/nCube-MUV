#!/usr/bin/sh

sudo chmod 777 ~/nCube-MUV/
cd ~/nCube-MUV
sudo chmod 777 *
pm2 start thyme.js

