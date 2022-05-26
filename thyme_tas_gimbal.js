// for viewpro Q30T pro 2 new
var SerialPort = require('serialport');

let gimbalPort = null;
let gimbalPortNum = gimbal.portnum;
let gimbalBaudrate = gimbal.baudrate;

const unit = 0.02197265625;
let strFromGimbal = '';

function gimbalPortOpening() {
    if (gimbalPort == null) {
        gimbalPort = new SerialPort(gimbalPortNum, {
            baudRate: parseInt(gimbalBaudrate, 10),
        });

        gimbalPort.on('open', gimbalPortOpen);
        gimbalPort.on('close', gimbalPortClose);
        gimbalPort.on('error', gimbalPortError);
        gimbalPort.on('data', gimbalPortData);

    } else {
        if (gimbalPort.isOpen) {

        } else {
            gimbalPort.open();
        }
    }
}

function gimbalPortSend() {
    let sendData = Buffer.from('3E3D003D00', 'hex');
    if (gimbalPort !== null) {
        gimbalPort.write(sendData, (err) => {
            if (err)
                return console.log('Error on write: ', err.message);
            // console.log('Data Send...');
        });
    } else {
        setTimeout(gimbalPortOpening, 2000);
    }
}
setInterval(gimbalPortSend, 100);

function gimbalPortOpen() {
    console.log('gimbalPort open. ' + gimbalPortNum + ' Data rate: ' + gimbalBaudrate);
}

function gimbalPortClose() {
    console.log('gimbalPort closed.');

    setTimeout(gimbalPortOpening, 2000);
}

function gimbalPortError(error) {
    console.log('gimbalPort error : ' + error);

    setTimeout(gimbalPortOpening, 2000);
}

let GimbalStatus = {};

function gimbalPortData(data) {
    strFromGimbal += data.toString('hex').toLowerCase();

    while (strFromGimbal.length >= 118) {
        let index = 8;
        let header = strFromGimbal.substring(0, index);

        if (header === '3e3d3673') {
            let roll = strFromGimbal.substring(index, index + 36);
            index += 36;
            let pitch = strFromGimbal.substring(index, index + 36);
            index += 36;
            let yaw = strFromGimbal.substring(index, index + 36);

            let rollImuAngle = roll.substring(0, 4);
            let rollRcTargetAngle = roll.substring(4, 8);
            let rollStatorRelAngle = roll.substring(8, 16);

            let pitchImuAngle = pitch.substring(0, 4);
            let pitchRcTargetAngle = pitch.substring(4, 8);
            let pitchStatorRelAngle = pitch.substring(8, 16);

            let yawImuAngle = yaw.substring(0, 4);
            let yawRcTargetAngle = yaw.substring(4, 8);
            let yawStatorRelAngle = yaw.substring(8, 16);

            rollImuAngle = Buffer.from(rollImuAngle, 'hex').readInt16LE() * unit;
            rollRcTargetAngle = Buffer.from(rollRcTargetAngle, 'hex').readInt16LE() * unit;
            rollStatorRelAngle = Buffer.from(rollStatorRelAngle, 'hex').readInt32LE() * unit;
            GimbalStatus.roll = rollStatorRelAngle;
            // console.log('rollImuAngle: ', rollImuAngle);
            // console.log('rollRcTargetAngle: ', rollRcTargetAngle);
            console.log('rollStatorRelAngle: ', rollStatorRelAngle);

            pitchImuAngle = Buffer.from(pitchImuAngle, 'hex').readInt16LE() * unit;
            pitchRcTargetAngle = Buffer.from(pitchRcTargetAngle, 'hex').readInt16LE() * unit;
            pitchStatorRelAngle = Buffer.from(pitchStatorRelAngle, 'hex').readInt32LE() * unit;
            GimbalStatus.pitch = pitchStatorRelAngle;
            // console.log('pitchImuAngle: ', pitchImuAngle);
            // console.log('pitchRcTargetAngle: ', pitchRcTargetAngle);
            console.log('pitchStatorRelAngle: ', pitchStatorRelAngle);

            yawImuAngle = Buffer.from(yawImuAngle, 'hex').readInt16LE() * unit;
            yawRcTargetAngle = Buffer.from(yawRcTargetAngle, 'hex').readInt16LE() * unit;
            yawStatorRelAngle = Buffer.from(yawStatorRelAngle, 'hex').readInt32LE() * unit;
            GimbalStatus.yaw = yawStatorRelAngle;
            // console.log('yawImuAngle: ', yawImuAngle);
            // console.log('yawRcTargetAngle: ', yawRcTargetAngle);
            console.log('yawStatorRelAngle: ', yawStatorRelAngle);

            mqtt_client.publish(my_cnt_name, Buffer.from(JSON.stringify(GimbalStatus)));
            sh_adn.crtci(my_cnt_name + '?rcn=0', 0, GimbalStatus, null, function () {
            });

            GimbalStatus = {};
            strFromGimbal = '';
        } else {
            strFromGimbal = strFromGimbal.substr(2);
        }
    }
}

gimbalPortOpening()
