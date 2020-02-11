/**
 * Copyright (c) 2018, OCEAN
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * 3. The name of the author may not be used to endorse or promote products derived from this software without specific prior written permission.
 * THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/**
 * Created by ryeubi on 2015-08-31.
 */

var http = require('http');
var express = require('express');
var fs = require('fs');
var mqtt = require('mqtt');
var util = require('util');
var url = require('url');
var ip = require('ip');
var shortid = require('shortid');
var moment = require('moment');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;

global.sh_adn = require('./http_adn');
var noti = require('./noti');
//var tas_mav = require('./thyme_tas_mav');
//var tas_sec = require('./thyme_tas_sec');
//var tas_mission = require('./thyme_tas_mission');


var HTTP_SUBSCRIPTION_ENABLE = 0;
var MQTT_SUBSCRIPTION_ENABLE = 0;

global.my_gcs_name = '';
global.my_parent_cnt_name = '';
global.my_cnt_name = '';
global.pre_my_cnt_name = '';
global.my_mission_parent = '';
global.my_mission_name = '';
global.my_sortie_name = 'disarm';

global.my_drone_type = 'pixhawk';
global.my_secure = 'off';

global.Req_auth = '';
global.Res_auth = '';
global.Result_auth = '';
global.Certification = '';

const retry_interval = 2500;
const normal_interval = 100;

global.authResult = 'yet';

var app = express();

//app.use(bodyParser.urlencoded({ extended: true }));
//app.use(bodyParser.json());
//app.use(bodyParser.json({ type: 'application/*+json' }));
//app.use(bodyParser.text({ type: 'application/*+xml' }));

// ?????? ????????.
var server = null;
var noti_topic = '';
var gcs_noti_topic = '';

var msw_noti_topic = [];

// ready for mqtt
for(var i = 0; i < conf.sub.length; i++) {
    if(conf.sub[i].name != null) {
        if(url.parse(conf.sub[i].nu).protocol === 'http:') {
            HTTP_SUBSCRIPTION_ENABLE = 1;
            if(url.parse(conf.sub[i]['nu']).hostname === 'autoset') {
                conf.sub[i]['nu'] = 'http://' + ip.address() + ':' + conf.ae.port + url.parse(conf.sub[i]['nu']).pathname;
            }
        }
        else if(url.parse(conf.sub[i].nu).protocol === 'mqtt:') {
            MQTT_SUBSCRIPTION_ENABLE = 1;
        }
        else {
            //console.log('notification uri of subscription is not supported');
            //process.exit();
        }
    }
}

var return_count = 0;
var request_count = 0;

function ready_for_notification() {
    if(HTTP_SUBSCRIPTION_ENABLE == 1) {
        server = http.createServer(app);
        server.listen(conf.ae.port, function () {
            console.log('http_server running at ' + conf.ae.port + ' port');
        });
    }

    if(MQTT_SUBSCRIPTION_ENABLE == 1) {
        for(var i = 0; i < conf.sub.length; i++) {
            if (conf.sub[i].name != null) {
                if (url.parse(conf.sub[i].nu).protocol === 'mqtt:') {
                    if (url.parse(conf.sub[i]['nu']).hostname === 'autoset') {
                        conf.sub[i]['nu'] = 'mqtt://' + conf.cse.host + '/' + conf.ae.id;
                        noti_topic = util.format('/oneM2M/req/+/%s/#', conf.ae.id);
                    }
                    else if (url.parse(conf.sub[i]['nu']).hostname === conf.cse.host) {
                        noti_topic = util.format('/oneM2M/req/+/%s/#', conf.ae.id);
                    }
                    else {
                        noti_topic = util.format('%s', url.parse(conf.sub[i].nu).pathname);
                    }
                }
            }
        }
        mqtt_connect(conf.cse.host, gcs_noti_topic, noti_topic);

        msw_mqtt_connect('localhost', 1883, msw_noti_topic);
    }
}

function git_clone(msw_name, repository_url) {
    var repo_arr = repository_url.split('/');
    var directory_name = msw_name + '_' + repo_arr[repo_arr.length-1].replace('.git', '');

    try {
        require('fs-extra').removeSync('./' + directory_name);
    }
    catch (e) {
        console.log(e.message);
    }

    var gitClone = spawn('git', ['clone', repository_url, directory_name]);

    gitClone.stdout.on('data', function(data) {
        console.log('stdout: ' + data);
    });

    gitClone.stderr.on('data', function(data) {
        console.log('stderr: ' + data);
    });

    gitClone.on('exit', function(code) {
        console.log('exit: ' + code);

        setTimeout(set_msw_config, 10, msw_name, directory_name);
    });

    gitClone.on('error', function(code) {
        console.log('error: ' + code);
    });
}

var msw_config = {};
function set_msw_config(msw_name, directory_name) {
    try {
        msw_config = JSON.parse(fs.readFileSync('./' + directory_name + '/config.json', 'utf8'));

        msw_config.name = msw_name;
        msw_config.gcs = drone_info.gcs;
        msw_config.drone = drone_info.drone;

        fs.writeFileSync('./' + directory_name + '/config.json', JSON.stringify(msw_config, null, 4), 'utf8');
        console.log('update ./' + directory_name + '/config.json');

        setTimeout(npm_install, 10, msw_name, directory_name);
    }
    catch (e) {
        msw_config.gcs = drone_info.gcs;
        msw_config.drone = drone_info.drone;
        msw_config.serialPortNum = '/dev/ttyUSB3';
        msw_config.serialBaudrate = '57600';
        fs.writeFileSync('./' + directory_name + '/config.json', JSON.stringify(msw_config, null, 4), 'utf8');
        console.log('create ./' + directory_name + '/config.json');

        setTimeout(npm_install, 10, msw_name, directory_name);
    }
}

function npm_install(msw_name, directory_name) {
    try {
        if (process.platform === 'win32') {
            var cmd = 'npm.cmd'
        }
        else {
            cmd = 'npm'
        }

        var npmInstall = spawn(cmd, ['install'], { cwd: process.cwd() + '/' + directory_name });

        npmInstall.stdout.on('data', function(data) {
            console.log('stdout: ' + data);
        });

        npmInstall.stderr.on('data', function(data) {
            console.log('stderr: ' + data);
        });

        npmInstall.on('exit', function(code) {
            console.log('exit: ' + code);

            setTimeout(fork_msw, 10, msw_name, directory_name);
        });

        npmInstall.on('error', function(code) {
            console.log('error: ' + code);

            setTimeout(npm_install, 10, msw_name, directory_name);
        });
    }
    catch (e) {
        console.log(e.message);
    }
}

function fork_msw(msw_name, directory_name) {
    var executable_name = directory_name.replace(msw_name + '_', '');

    var npmInstall = spawn('node', [executable_name], { cwd: process.cwd() + '/' + directory_name });

    npmInstall.stdout.on('data', function(data) {
        console.log('stdout: ' + data);
    });

    npmInstall.stderr.on('data', function(data) {
        console.log('stderr: ' + data);
    });

    npmInstall.on('exit', function(code) {
        console.log('exit: ' + code);
    });

    npmInstall.on('error', function(code) {
        console.log('error: ' + code);

        setTimeout(npm_install, 10, directory_name);
    });
}

function git_pull() {

}

function ae_response_action(status, res_body, callback) {
    var aeid = res_body['m2m:ae']['aei'];
    conf.ae.id = aeid;
    callback(status, aeid);
}

function create_cnt_all(count, callback) {
    if(conf.cnt.length == 0) {
        callback(2001, count);
    }
    else {
        if(conf.cnt.hasOwnProperty(count)) {
            var parent = conf.cnt[count].parent;
            var rn = conf.cnt[count].name;
            sh_adn.crtct(parent, rn, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2001 || rsc == 4105) {
                    create_cnt_all(++count, function (status, count) {
                        callback(status, count);
                    });
                }
                else {
                    callback(9999, count);
                }
            });
        }
        else {
            callback(2001, count);
        }
    }
}

function delete_sub_all(count, callback) {
    if(conf.sub.length == 0) {
        callback(2001, count);
    }
    else {
        if(conf.sub.hasOwnProperty(count)) {
            var target = conf.sub[count].parent + '/' + conf.sub[count].name;
            sh_adn.delsub(target, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2002 || rsc == 2000 || rsc == 4105 || rsc == 4004) {
                    delete_sub_all(++count, function (status, count) {
                        callback(status, count);
                    });
                }
                else {
                    callback(9999, count);
                }
            });
        }
        else {
            callback(2001, count);
        }
    }
}

function create_sub_all(count, callback) {
    if(conf.sub.length == 0) {
        callback(2001, count);
    }
    else {
        if(conf.sub.hasOwnProperty(count)) {
            var parent = conf.sub[count].parent;
            var rn = conf.sub[count].name;
            var nu = conf.sub[count].nu;
            sh_adn.crtsub(parent, rn, nu, count, function (rsc, res_body, count) {
                if (rsc == 5106 || rsc == 2001 || rsc == 4105) {
                    create_sub_all(++count, function (status, count) {
                        callback(status, count);
                    });
                }
                else {
                    callback('9999', count);
                }
            });
        }
        else {
            callback(2001, count);
        }
    }
}

var drone_info = {};

function retrieve_my_cnt_name(callback) {
    sh_adn.rtvct('/Mobius/' + conf.ae.approval_gcs +'/approval/'+conf.ae.name+'/la', 0, function (rsc, res_body, count) {
        if(rsc == 2000) {
            drone_info = res_body[Object.keys(res_body)[0]].con;
            //console.log(drone_info);

            conf.sub = [];
            conf.cnt = [];
            conf.fc = [];

            my_gcs_name = drone_info.gcs;

            var info = {};
            info.parent = '/Mobius/' + drone_info.gcs;
            info.name = 'Drone_Data';
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info = {};
            info.parent = '/Mobius/' + drone_info.gcs + '/Drone_Data';
            info.name = drone_info.drone;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info.parent = '/Mobius/' + drone_info.gcs + '/Drone_Data/' + drone_info.drone;
            info.name = my_sortie_name;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            my_parent_cnt_name = info.parent;
            my_cnt_name = my_parent_cnt_name + '/' + info.name;

            // set container for mission
            info = {};
            info.parent = '/Mobius/' + drone_info.gcs;
            info.name = 'Mission_Data';
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            info = {};
            info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data';
            info.name = drone_info.drone;
            conf.cnt.push(JSON.parse(JSON.stringify(info)));

            if(drone_info.hasOwnProperty('mission')) {
                for (var mission_name in drone_info.mission) {
                    if(drone_info.mission.hasOwnProperty(mission_name)) {
                        info = {};
                        info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone;
                        info.name = mission_name;
                        conf.cnt.push(JSON.parse(JSON.stringify(info)));

                        var chk_cnt = 'container';
                        if(drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
                            for (var idx in drone_info.mission[mission_name][chk_cnt]) {
                                if (drone_info.mission[mission_name][chk_cnt].hasOwnProperty(idx)) {
                                    var container_name = drone_info.mission[mission_name][chk_cnt][idx];
                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name;
                                    info.name = container_name;
                                    conf.cnt.push(JSON.parse(JSON.stringify(info)));

                                    msw_noti_topic.push(info.parent + '/' + info.name);

                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name + '/' + container_name;
                                    info.name = my_sortie_name;
                                    conf.cnt.push(JSON.parse(JSON.stringify(info)));
                                }
                            }
                        }

                        chk_cnt = 'sub_container';
                        if(drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
                            for (idx in drone_info.mission[mission_name][chk_cnt]) {
                                if (drone_info.mission[mission_name][chk_cnt].hasOwnProperty(idx)) {
                                    container_name = drone_info.mission[mission_name][chk_cnt][idx];
                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name;
                                    info.name = container_name;
                                    conf.cnt.push(JSON.parse(JSON.stringify(info)));

                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name + '/' + container_name;
                                    info.name = 'sub_msw';
                                    info.nu = 'mqtt://' + conf.cse.host + '/' + conf.ae.id + '?ct=json';
                                    conf.sub.push(JSON.parse(JSON.stringify(info)));
                                }
                            }
                        }

                        chk_cnt = 'fc_container';
                        if(drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
                            for (idx in drone_info.mission[mission_name][chk_cnt]) {
                                if (drone_info.mission[mission_name][chk_cnt].hasOwnProperty(idx)) {
                                    container_name = drone_info.mission[mission_name][chk_cnt][idx];
                                    info = {};
                                    info.parent = '/Mobius/' + drone_info.gcs + '/Mission_Data/' + drone_info.drone + '/' + mission_name;
                                    info.name = container_name;
                                    conf.fc.push(JSON.parse(JSON.stringify(info)));
                                }
                            }
                        }

                        chk_cnt = 'git';
                        if(drone_info.mission[mission_name].hasOwnProperty(chk_cnt)) {
                            git_clone(mission_name, drone_info.mission[mission_name][chk_cnt]);
                        }
                    }
                }
            }

            if(drone_info.hasOwnProperty('mav_ver')) {
                mav_ver = drone_info.mav_ver;
            }
            else {
                mav_ver = 1;
            }

            if(drone_info.hasOwnProperty('type')) {
                my_drone_type = drone_info.type;
            }
            else {
                my_drone_type = 'pixhawk';
            }

            if(drone_info.hasOwnProperty('secure')) {
                my_secure = drone_info.secure;
            }
            else {
                my_secure = 'off';
            }

            gcs_noti_topic = '/Mobius/' + my_gcs_name + '/GCS_Data/' + drone_info.drone;
            MQTT_SUBSCRIPTION_ENABLE = 1;
            sh_state = 'crtct';
            setTimeout(http_watchdog, normal_interval);
            callback();
        }
        else {
            console.log('x-m2m-rsc : ' + rsc + ' <----' + res_body);
            setTimeout(http_watchdog, retry_interval);
            callback();
        }
    });
}

function http_watchdog() {
    if (sh_state === 'crtae') {
        console.log('[sh_state] : ' + sh_state);
        sh_adn.crtae(conf.ae.parent, conf.ae.name, conf.ae.appid, function (status, res_body) {
            console.log(res_body);
            if (status == 2001) {
                ae_response_action(status, res_body, function (status, aeid) {
                    console.log('x-m2m-rsc : ' + status + ' - ' + aeid + ' <----');
                    sh_state = 'rtvae';
                    request_count = 0;
                    return_count = 0;

                    setTimeout(http_watchdog, normal_interval);
                });
            }
            else if (status == 5106 || status == 4105) {
                console.log('x-m2m-rsc : ' + status + ' <----');
                sh_state = 'rtvae';

                setTimeout(http_watchdog, normal_interval);
            }
            else {
                console.log('x-m2m-rsc : ' + status + ' <----');
                setTimeout(http_watchdog, retry_interval);
            }
        });
    }
    else if (sh_state === 'rtvae') {
        if (conf.ae.id === 'S') {
            conf.ae.id = 'S' + shortid.generate();
        }

        console.log('[sh_state] : ' + sh_state);
        sh_adn.rtvae(conf.ae.parent + '/' + conf.ae.name, function (status, res_body) {
            if (status == 2000) {
                var aeid = res_body['m2m:ae']['aei'];
                console.log('x-m2m-rsc : ' + status + ' - ' + aeid + ' <----');

                if(conf.ae.id != aeid && conf.ae.id != ('/'+aeid)) {
                    console.log('AE-ID created is ' + aeid + ' not equal to device AE-ID is ' + conf.ae.id);
                }
                else {
                    sh_state = 'rtvct';
                    request_count = 0;
                    return_count = 0;

                    setTimeout(http_watchdog, normal_interval);
                }
            }
            else {
                console.log('x-m2m-rsc : ' + status + ' <----');
                setTimeout(http_watchdog, retry_interval);
            }
        });
    }
    else if(sh_state === 'rtvct') {
        retrieve_my_cnt_name(function () {

        });
    }
    else if (sh_state === 'crtct') {
        console.log('[sh_state] : ' + sh_state);
        create_cnt_all(request_count, function (status, count) {
            if(status == 9999) {
                setTimeout(http_watchdog, retry_interval);
            }
            else {
                request_count = ++count;
                return_count = 0;
                if (conf.cnt.length <= count) {
                    sh_state = 'delsub';
                    request_count = 0;
                    return_count = 0;

                    setTimeout(http_watchdog, normal_interval);
                }
            }
        });
    }
    else if (sh_state === 'delsub') {
        console.log('[sh_state] : ' + sh_state);
        delete_sub_all(request_count, function (status, count) {
            if(status == 9999) {
                setTimeout(http_watchdog, retry_interval);
            }
            else {
                request_count = ++count;
                return_count = 0;
                if (conf.sub.length <= count) {
                    sh_state = 'crtsub';
                    request_count = 0;
                    return_count = 0;

                    setTimeout(http_watchdog, normal_interval);
                }
            }
        });
    }
    else if (sh_state === 'crtsub') {
        console.log('[sh_state] : ' + sh_state);
        create_sub_all(request_count, function (status, count) {
            if(status == 9999) {
                setTimeout(http_watchdog, retry_interval);
            }
            else {
                request_count = ++count;
                return_count = 0;
                if (conf.sub.length <= count) {
                    sh_state = 'crtci';

                    ready_for_notification();

                    // tas_mav.ready();
                    // tas_sec.ready();
                    // tas_mission.ready();

                    setTimeout(http_watchdog, normal_interval);
                }
            }
        });
    }
    else if (sh_state === 'crtci') {
        //setTimeout(check_rtv_cnt, 10000);
    }
}

setTimeout(http_watchdog, normal_interval);

function check_rtv_cnt() {
    sh_state = 'rtvct';
    http_watchdog();
}

// for notification
//var xmlParser = bodyParser.text({ type: '*/*' });

function mqtt_connect(serverip, gcs_noti_topic, noti_topic) {
    if(mqtt_client == null) {
        if (conf.usesecure === 'disable') {
            var connectOptions = {
                host: serverip,
                port: conf.cse.mqttport,
//              username: 'keti',
//              password: 'keti123',
                protocol: "mqtt",
                keepalive: 10,
//              clientId: serverUID,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                rejectUnauthorized: false
            };
        }
        else {
            connectOptions = {
                host: serverip,
                port: conf.cse.mqttport,
                protocol: "mqtts",
                keepalive: 10,
//              clientId: serverUID,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                key: fs.readFileSync("./server-key.pem"),
                cert: fs.readFileSync("./server-crt.pem"),
                rejectUnauthorized: false
            };
        }

        mqtt_client = mqtt.connect(connectOptions);
    }

    mqtt_client.on('connect', function () {
        mqtt_client.subscribe(gcs_noti_topic);
        console.log('[mqtt_connect] gcs_noti_topic : ' + gcs_noti_topic);

        mqtt_client.subscribe(noti_topic);
        console.log('[mqtt_connect] noti_topic : ' + noti_topic);
    });

    mqtt_client.on('message', function (topic, message) {
        if(topic == gcs_noti_topic) {
            tas_mav.gcs_noti_handler(message);
        }
        else {
            if(topic.includes('/oneM2M/req/')) {
                var jsonObj = JSON.parse(message.toString());

                if (jsonObj['m2m:rqp'] == null) {
                    jsonObj['m2m:rqp'] = jsonObj;
                }

                noti.mqtt_noti_action(topic.split('/'), jsonObj);
            }
            else {
            }
        }
    });

    mqtt_client.on('error', function (err) {
        console.log(err.message);
    });
}

function msw_mqtt_connect(broker_ip, port, noti_topic) {
    if(msw_mqtt_client == null) {
        if (conf.usesecure === 'disable') {
            var connectOptions = {
                host: broker_ip,
                port: port,
//              username: 'keti',
//              password: 'keti123',
                protocol: "mqtt",
                keepalive: 10,
//              clientId: serverUID,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                rejectUnauthorized: false
            };
        }
        else {
            connectOptions = {
                host: broker_ip,
                port: port,
                protocol: "mqtts",
                keepalive: 10,
//              clientId: serverUID,
                protocolId: "MQTT",
                protocolVersion: 4,
                clean: true,
                reconnectPeriod: 2000,
                connectTimeout: 2000,
                key: fs.readFileSync("./server-key.pem"),
                cert: fs.readFileSync("./server-crt.pem"),
                rejectUnauthorized: false
            };
        }

        msw_mqtt_client = mqtt.connect(connectOptions);
    }

    msw_mqtt_client.on('connect', function () {
        console.log('[msw_mqtt_connect] connected to ' + broker_ip);
        for(var idx in noti_topic) {
            if(noti_topic.hasOwnProperty(idx)) {
                msw_mqtt_client.subscribe(noti_topic[idx]);
                console.log('[msw_mqtt_connect] noti_topic[' + idx + ']: ' + noti_topic[idx]);
            }
        }
    });

    msw_mqtt_client.on('message', function (topic, message) {
        var msg_obj = JSON.parse(message.toString());

        send_to_Mobius((topic + '/' + my_sortie_name), msg_obj, parseInt(Math.random() * 10));

        console.log(topic + ' - ' + JSON.stringify(msg_obj));
    });

    msw_mqtt_client.on('error', function (err) {
        console.log(err.message);
    });
}

function send_to_Mobius(topic, content_each_obj, gap) {
    setTimeout(function (topic, content_each_obj) {
        sh_adn.crtci(topic+'?rcn=0', 0, content_each_obj, null, function () {

        });
    }, gap, topic, content_each_obj);
}
