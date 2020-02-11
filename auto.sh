#!/usr/bin/sh

lte_flag=0
ttyUSB=`ls /dev/ttyUSB3`
while [ $lte_flag -eq 0 ]
do
  if [ -n "$ttyUSB" ]; then
    echo "ttyUSB... OK ! "
    if ping -q -c 1 -W 1 8.8.8.8 > /dev/null; then
      lte_flag=1
      echo "LTE... OK ! "
    fi
  else
    echo "IPv4 is Down"
    sleep 5
    sudo reboot
  fi
done

echo "IPv4 is Up"
sudo chmod 777 /home/pi/nCube-sparrow/
cd /home/pi/nCube-sparrow
sudo chmod 777 *
git stash
git pull
sleep 5
git stash pop
pm2 start thyme.js

