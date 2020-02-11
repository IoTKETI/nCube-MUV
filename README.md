# nCube-MUV
Start Guide

* Install dependencies
```
$ curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -

$ sudo apt-get install -y nodejs

$ node -v

$ sudo npm install -g pm2

$ git clone https://github.com/IoTKETI/nCube-MUV

$ cd /home/pi/nCube-MUV

$ npm install
```

* Autorun at boot in raspberry-pi
```
$ sudo nano /etc/xdg/lxsession/LXDE-pi/autostart

Add executable code to last line

$ sh /home/pi/nCube-MUV/auto.sh > /home/pi/nCube-MUV/auto.sh.log 2>&1
```
