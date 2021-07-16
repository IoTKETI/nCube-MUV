#!/usr/bin/sh

sudo chmod 777 /home/pi/nCube-MUV/
cd /home/pi/nCube-MUV
sudo chmod 777 *
pm2 start thyme.js

