/**
 * Created by Il Yeup, Ahn in KETI on 2019-11-30.
 */

/**
 * Copyright (c) 2019, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// for TAS of mission
var moment = require('moment');

var missionPort = null;

var missionPortNum = '/dev/ttyUSB3';
var missionBaudrate = '57600';

exports.ready = function tas_ready() {
    if(my_mission_name == 'h2battery') {
        missionPortNum = '/dev/ttyUSB3';
        missionBaudrate = '57600';
        missionPortOpening();
    }
    else if(my_mission_name == 'micro') {
        missionPortNum = '/dev/ttyUSB3';
        missionBaudrate = '9600';
        missionPortOpening();
    }
};

var aggr_content = {};
function send_aggr_to_Mobius(topic, content_each, gap) {
    if(aggr_content.hasOwnProperty(topic)) {
        var timestamp = moment().format('YYYY-MM-DDTHH:mm:ssSSS');
        aggr_content[topic][timestamp] = content_each;
    }
    else {
        aggr_content[topic] = {};
        timestamp = moment().format('YYYY-MM-DDTHH:mm:ssSSS');
        aggr_content[topic][timestamp] = content_each;

        setTimeout(function () {
            sh_adn.crtci(topic+'?rcn=0', 0, aggr_content[topic], null, function () {

            });

            delete aggr_content[topic];
        }, gap, topic);
    }
}

var SerialPort = require('serialport');

function missionPortOpening() {
    if (missionPort == null) {
        missionPort = new SerialPort(missionPortNum, {
            baudRate: parseInt(missionBaudrate, 10),
        });

        missionPort.on('open', missionPortOpen);
        missionPort.on('close', missionPortClose);
        missionPort.on('error', missionPortError);
        missionPort.on('data', missionPortData);
    }
    else {
        if (missionPort.isOpen) {

        }
        else {
            missionPort.open();
        }
    }
}

function missionPortOpen() {
    console.log('missionPort open. ' + missionPortNum + ' Data rate: ' + missionBaudrate);
}

function missionPortClose() {
    console.log('missionPort closed.');

    setTimeout(missionPortOpening, 2000);
}

function missionPortError(error) {
    var error_str = error.toString();
    console.log('[missionPort error]: ' + error.message);
    if (error_str.substring(0, 14) == "Error: Opening") {

    }
    else {
        console.log('missionPort error : ' + error);
    }

    setTimeout(missionPortOpening, 2000);
}

var missionStr = '';
function missionPortData(data) {
    if(my_mission_name == 'h2battery') {
        missionStr += data.toString();

        //console.log(missionStr);

        if(missionStr[missionStr.length-1] == '\n') {
            var missionPacket = missionStr.substr(0, missionStr.length);

            //missionPacket.replace(/\'\u0000\n\'/g, '\n');
            missionPacket = missionPacket.replace(/ /g, '');
            var missionPacketArr = missionPacket.split('\n');
            var missionStrArr = missionPacketArr[1].split('\t');

//            console.log(missionPacketArr[1]);
//            console.log(missionStrArr);

            setTimeout(parseMission, 0, missionStrArr);
            missionStr = missionStr.substr(0, missionStr.length);
        }

        /*if(missionStr.length >= 88) {
            var missionPacket = '';
            var start = 0;
            var refLen = 0;
            var lenCount = 0;
            for (var i = 0; i < missionStr.length; i += 2) {
                var head = missionStr.substr(0, 2);
                var tail = missionStr.substr(86, 2);

                if(head == 'fe' && tail == 'ff') {
                    missionPacket = missionStr.substr(0, 88);
                    console.log('Parse Mission  - ' + missionPacket);
                    setTimeout(parseMission, 0, missionPacket);
                    missionStr = missionStr.substr(88);
                    i = -2;
                    if (missionStr.length <= 88) {
                        break;
                    }
                }
                else {
                    missionStr = missionStr.substr(i + 2);
                    i = -2;
                    if (missionStr.length <= 88) {
                        break;
                    }
                }
            }
        }*/
    }
}

var mission = {};
function parseMission(missionPacket) {
    if(my_mission_name == 'h2battery') {
        mission.H2BATTERY = {};

        var h2 = parseFloat(missionPacket[1], 10);
        var output_voltage = parseFloat(missionPacket[2], 10);
        var output_current = parseFloat(missionPacket[3], 10);
        var battery_voltage = parseFloat(missionPacket[4], 10);
        var battery_current = parseFloat(missionPacket[5], 10);
        var powerpack_state = parseInt(missionPacket[6], 10);
        var error_code = parseInt(missionPacket[7], 10);
        var powerpack_temp = parseFloat(missionPacket[8], 10);
        var fuelcell1_voltage = parseFloat(missionPacket[9], 10);
        var fuelcell1_temp1 = parseFloat(missionPacket[10], 10);
        var fuelcell1_temp2 = parseFloat(missionPacket[11], 10);
        var fuelcell1_current = parseFloat(missionPacket[12], 10);
        var fuelcell2_voltage = parseFloat(missionPacket[16], 10);
        var fuelcell2_temp1 = parseFloat(missionPacket[17], 10);
        var fuelcell2_temp2 = parseFloat(missionPacket[18], 10);
        var fuelcell2_current = parseFloat(missionPacket[19], 10);

        /*
                var base_offset = 10;
                var decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var h2 = decimal / 10;

                base_offset = 14;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var output_voltage = decimal / 100;

                base_offset = 18;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var output_current = decimal / 100;

                base_offset = 22;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var battery_voltage = decimal / 100;

                base_offset = 26;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var battery_current = decimal / 100;

                base_offset = 34;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var powerpack_temp = decimal / 10 - 40;

                base_offset = 38;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var fuelcell1_voltage = decimal / 10;

                base_offset = 42;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var fuelcell1_temp1 = decimal / 10 - 40;

                base_offset = 46;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var fuelcell1_temp2 = decimal / 10 - 40;

                base_offset = 50;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var fuelcell1_current = decimal / 100;

                base_offset = 62;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var fuelcell2_voltage = decimal / 10;

                base_offset = 66;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var fuelcell2_temp1 = decimal / 10 - 40;

                base_offset = 70;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var fuelcell2_temp2 = decimal / 10 - 40;

                base_offset = 74;
                decimal = parseInt(missionPacket.substr(base_offset, 2), 16) * 100 + parseInt(missionPacket.substr(base_offset + 2, 2), 16);
                var fuelcell2_current = decimal / 100;
        */
        //console.log(mavPacket);
        mission.H2BATTERY.h2 = h2;
        mission.H2BATTERY.output_voltage = output_voltage;
        mission.H2BATTERY.output_current = output_current;
        mission.H2BATTERY.battery_voltage = battery_voltage;
        mission.H2BATTERY.battery_current = battery_current;

        mission.H2BATTERY.powerpack_state = powerpack_state;
        mission.H2BATTERY.error_code = error_code;
        mission.H2BATTERY.powerpack_temp = powerpack_temp;

        mission.H2BATTERY.fuelcell1_voltage = fuelcell1_voltage;
        mission.H2BATTERY.fuelcell1_temp1 = fuelcell1_temp1;
        mission.H2BATTERY.fuelcell1_temp2 = fuelcell1_temp2;
        mission.H2BATTERY.fuelcell1_current = fuelcell1_current;

        mission.H2BATTERY.fuelcell2_voltage = fuelcell2_voltage;
        mission.H2BATTERY.fuelcell2_temp1 = fuelcell2_temp1;
        mission.H2BATTERY.fuelcell2_temp2 = fuelcell2_temp2;
        mission.H2BATTERY.fuelcell2_current = fuelcell2_current;

        send_aggr_to_Mobius(my_mission_parent + '/' + my_mission_name, mission, 1000);
    }
}

exports.request_to_mission = function(cinObj) {
    if(my_mission_name == 'micro') {
        if (missionPort != null) {
            if (missionPort.isOpen) {
                var con = cinObj.con;
                console.log(con);

                var con_arr = con.split(',');

                var msdata = [];
                if(con_arr.length >= 2) {
                    if(parseInt(con_arr[0], 10) < 8 && parseInt(con_arr[1], 10) < 8) {
                        var stx = 'A2';
                        var command = '030' + con_arr[0] + '0' + con_arr[1] + '000000000000';
                        var crc = 0;
                        for(var i = 0; i < command.length; i += 2) {
                            crc ^= parseInt(command.substr(i, 2), 16);
                        }

                        if(crc < 16) {
                            command += '0' + crc.toString().toString('hex');
                        }
                        else {
                            command += crc.toString().toString('hex');
                        }

                        var etx = 'A3';
                        command = stx + command + etx;
                        console.log(command);
                        msdata = Buffer.from(command, 'hex');
                        console.log(msdata);
                        missionPort.write(msdata);
                    }
                }
            }
        }
    }
};
