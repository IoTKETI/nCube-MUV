#!/usr/bin/sh

sudo ifconfig eth0 192.168.$1.$2

sudo /etc/init.d/dhcpcd restart

sudo route add -net 192.168.$1.0 netmask 255.255.255.0 gw 192.168.$1.$2

ifconfig
