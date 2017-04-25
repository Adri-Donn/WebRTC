/****************************************************************************************************
 *                                              Vars      
 ****************************************************************************************************/
/* ---------- Declaration ---------- */
var global = {};
var RTC = {}, peerConnection;
var remoteVideo = $('#remote-video')[0];
var sdpConstraints = {
    offerToReceiveAudio: 1,
    offerToReceiveVideo: 1,
};

/* ---------- Affectations ---------- */
global.mediaAccessAlertMessage = 'This app wants to use your camera and microphone.\n\nGrant it the access!';
global.isGetAvailableRoom = true;

/****************************************************************************************************
 *                                          Other functions      
 ****************************************************************************************************/
/* ---------- String validation ---------- */
String.prototype.validate = function () {
    return this.replace(/-/g, '__').replace(/\?/g, '-qmark').replace(/ /g, '--').replace(/\n/g, '-n').replace(/</g, '-lt').replace(/>/g, '-gt').replace(/&/g, '-amp').replace(/#/g, '-nsign').replace(/__t-n/g, '__t').replace(/\+/g, '_plus_').replace(/=/g, '-equal');
};

/* ---------- Hidding items ---------- 
 * Hidding :    - The create room panel
 *              - The notifier pannel
 */
function hideListsAndBoxes() {
    $('.create-room-panel').css('display', 'none');
    $('aside').css('display', 'none');

    global.isGetAvailableRoom = false;
}

/****************************************************************************************************
 *                                             RTC      
 ****************************************************************************************************/
/* ---------- RTC initialisation ---------- 
 * ICE servers gives you a way to connect you directly with a peer using stun/tun and other way to 
 * give you an unique identifier and pass over the firewall.
 * 
 * You must declare somes stun servers in the array "iceServers". 
 * 
 * The RTCPeerConnection interface represents a WebRTC connection between the local computer and a 
 * remote peer. It provides methods to connect to a remote peer, maintain and monitor the connection, 
 * and close the connection once it's no longer needed.
 * 
 * peerConnection.onicecandidate is an EventHandler which specifies a function to be called when the 
 * icecandidate event occurs on an RTCPeerConnection instance. This happens whenever the local ICE 
 * agent needs to deliver a message to the other peer through the signaling server. This lets the ICE 
 * agent perform negotiation with the remote peer without the browser itself needing to know any 
 * specifics about the technology being used for signaling; simply implement this method to use 
 * whatever messaging technology you choose to send the ICE candidate to the remote peer.
 * 
 * TCPeerConnection.ontrack property is an EventHandler which specifies a function to be called when 
 * the track event occurs on an RTCPeerConnection interface. The function receives as input the event 
 * object, of type RTCTrackEvent; this event is sent when a new incoming MediaStreamTrack has been 
 * created and associated with an RTCRtpReceiver object which has been added to the set of receivers 
 * on connection.
 * 
 * The RTCPeerConnection.addStream() method adds a MediaStream as a local source of audio or video. 
 * If the negotiation already happened, a new one will be needed for the remote peer to be able to use it.
 * !!! DEPRECATED !!!
 * This feature has been removed from the Web standards. 
 * Though some browsers may still support it, it is in the process of being dropped. Avoid using it and 
 * update existing code if possible; see the compatibility table at the bottom of this page to guide your 
 * decision. 
 * Be aware that this feature may cease to work at any time!
 * You should, compatibility allowing [2], switch to using the addTrack() method instead.
 */
RTC.init = function () {
    try {
        var iceServers = [];

        // First stun server.
        iceServers.push({
            urls: ['stun:stun.l.google.com:19302']
        });

        // Second stun server.
        iceServers.push({
            urls: ['stun:stun.services.mozilla.com']
        });

        peerConnection = new window.RTCPeerConnection({ "iceServers": iceServers });
        peerConnection.onicecandidate = RTC.checkLocalICE;

        peerConnection.ontrack = RTC.checkRemoteStream;
        peerConnection.addStream(global.clientStream); // !!! DEPRECATED !!! => Switch to using the addTrack() method instead.
    } catch (e) {
        document.title = 'WebRTC is not supported in this web browser!';
        alert('WebRTC is not supported in this web browser!');
    }
};

/* ---------- Create an RTC offer ---------- 
 * The createOffer() method of the RTCPeerConnection interface initiates the creation of an SDP offer which includes information 
 * about any MediaStreamTracks already attached to the WebRTC session, codec and options supported by the browser, and any 
 * candidates already gathered by the ICE agent, for the purpose of being sent over the signaling channel to a potential peer to 
 * request a connection or to update the configuration of an existing connection.
 * 
 * The RTCPeerConnection.setLocalDescription() method changes the local description associated with the connection. 
 * This description specifies the properties of the local end of the connection, including the media format. The actual connection 
 * is affected by this change, so it must be able to support both the old and new descriptions in order for the change to actually 
 * take place. The method takes a single parameter—the session description—and it returns a Promise which is fulfilled once the 
 * description has been changed, asynchronously.
 */
RTC.createOffer = function () {
    document.title = 'Creating offer...';

    RTC.init();

    peerConnection.createOffer(function (sessionDescription) {
        peerConnection.setLocalDescription(sessionDescription);

        document.title = 'Created offer successfully!';
        sdp = JSON.stringify(sessionDescription);

        var data = {
            sdp: sdp,
            userToken: global.userToken,
            roomToken: global.roomToken
        };

        $.ajax('/WebRTC/PostSDP', {
            method: 'POST',
            data: data,
            success: function (response) {
                if (response) {
                    document.title = 'Posted offer successfully!';

                    RTC.checkRemoteICE();
                    RTC.waitForAnswer();
                }
            }
        });

    }, onSdpError, sdpConstraints);
};

/* ---------- Wait for an RTC answer (after sent an offer) ---------- 
 * The RTCPeerConnection.setRemoteDescription() method changes the remote description associated with the connection. 
 * This description specifies the properties of the remote end of the connection, including the media format. The actual 
 * connection is affected by this change, so it must be able to support both the old and new descriptions in order for the 
 * change to actually take place. The method takes a single parameter—the session description—and it returns a Promise which 
 * is fulfilled once the description has been changed, asynchronously.
 */
RTC.waitForAnswer = function () {
    document.title = 'Waiting for answer...';

    var data = {
        userToken: global.userToken,
        roomToken: global.roomToken
    };

    $.ajax('/WebRTC/GetSDP', {
        method: 'POST',
        data: data,
        success: function (response) {
            if (response !== false) {
                document.title = 'Got answer...';
                response = response.sdp;
                try {
                    sdp = JSON.parse(response);
                    peerConnection.setRemoteDescription(new window.RTCSessionDescription(sdp));
                } catch (e) {
                    sdp = response;
                    peerConnection.setRemoteDescription(new window.RTCSessionDescription(sdp));
                }
            } else
                setTimeout(RTC.waitForAnswer, 100);
        }
    });
};

/* ---------- Waiting for an offer ---------- */
RTC.waitForOffer = function () {
    document.title = 'Waiting for offer...';
    var data = {
        userToken: global.userToken,
        roomToken: global.roomToken
    };

    $.ajax('/WebRTC/GetSDP', {
        method: 'POST',
        data: data,
        success: function (response) {
            if (response !== false) {
                document.title = 'Got offer...';
                RTC.createAnswer(response.sdp);
            } else setTimeout(RTC.waitForOffer, 100);
        }
    });
};

/* ---------- Create an answer to an offer ---------- 
 * The createAnswer() method on the RTCPeerConnection interface creates an answer to an offer received from a remote peer during 
 * the offer/answer negotiation of a WebRTC connection. Once the answer is created, it should be sent to the source of the offer 
 * to continue the negotiation process.
 */
RTC.createAnswer = function (sdpResponse) {
    RTC.init();

    document.title = 'Creating answer...';

    var sdp;
    try {
        sdp = JSON.parse(sdpResponse);

        peerConnection.setRemoteDescription(new window.RTCSessionDescription(sdp));
    } catch (e) {
        sdp = sdpResponse;

        peerConnection.setRemoteDescription(new window.RTCSessionDescription(sdp));
    }

    peerConnection.createAnswer(function (sessionDescription) {
        peerConnection.setLocalDescription(sessionDescription);

        document.title = 'Created answer successfully!';

        sdp = JSON.stringify(sessionDescription);

        var data = {
            sdp: sdp,
            userToken: global.userToken,
            roomToken: global.roomToken
        };

        $.ajax('/WebRTC/PostSDP', {
            method: 'POST',
            data: data,
            success: function () {
                document.title = 'Posted answer successfully!';
            }
        });

    }, onSdpError);
};

/* ---------- Check if we got a remote stream ---------- 
 * The RTCIceCandidate interface of the the WebRTC API represents a candidate internet connectivity 
 * establishment (ICE) server for establishing an RTCPeerConnection.
 * 
 * The RTCPeerConnection interface represents a WebRTC connection between the local computer and a 
 * remote peer. It provides methods to connect to a remote peer, maintain and monitor the connection, 
 * and close the connection once it's no longer needed.
 */
RTC.checkRemoteICE = function () {
    if (global.isGotRemoteStream) return;

    if (!peerConnection) {
        setTimeout(RTC.checkRemoteICE, 1000);
        return;
    }

    var data = {
        userToken: global.userToken,
        roomToken: global.roomToken
    };

    $.ajax('/WebRTC/GetICE', {
        method: 'POST',
        data: data,
        success: function (response) {
            if (response === false && !global.isGotRemoteStream) setTimeout(RTC.checkRemoteICE, 1000);
            else {
                try {
                    candidate = new window.RTCIceCandidate({ sdpMLineIndex: response.label, candidate: JSON.parse(response.candidate) });
                    peerConnection.addIceCandidate(candidate);

                    !global.isGotRemoteStream && setTimeout(RTC.checkRemoteICE, 10);
                } catch (e) {
                    try {
                        candidate = new window.RTCIceCandidate({ sdpMLineIndex: response.label, candidate: JSON.parse(response.candidate) });
                        peerConnection.addIceCandidate(candidate);

                        !global.isGotRemoteStream && setTimeout(RTC.checkRemoteICE, 10);
                    } catch (e) {
                        !global.isGotRemoteStream && setTimeout(RTC.checkRemoteICE, 1000);
                    }
                }
            }
        },
        error: function (response) {
            setTimeout(RTC.checkRemoteICE, 1000);
        }
    });
};

/* ---------- Check the local ICE candidate ---------- */
RTC.checkLocalICE = function (event) {
    if (global.isGotRemoteStream) return;

    var candidate = event.candidate;

    if (candidate) {
        var data = {
            candidate: JSON.stringify(candidate.candidate),
            label: candidate.sdpMLineIndex,
            userToken: global.userToken,
            roomToken: global.roomToken
        };

        $.ajax('/WebRTC/PostICE', {
            method: 'POST',
            data: data,
            success: function () {
                document.title = 'Posted an ICE candidate!';
            }
        });
    }
};

/* ---------- Check the remote stream ---------- 
 * It display the remote vidéo.
 */
RTC.checkRemoteStream = function (remoteEvent) {
    if (remoteEvent) {
        document.title = 'Got a clue for remote video stream!';
        remoteVideo.srcObject = remoteEvent.streams[0];
        $(remoteVideo).show();
        RTC.waitUntilRemoteStreamStartFlowing();
    }
};

/* ---------- Wait until the remote stream start flowing ---------- */
RTC.waitUntilRemoteStreamStartFlowing = function () {
    document.title = 'Waiting for remote stream flow!';
    if (!(remoteVideo.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA || remoteVideo.paused || remoteVideo.currentTime <= 0)) {
        global.isGotRemoteStream = true;

        document.title = 'Finally got the remote stream!';
    } else setTimeout(RTC.waitUntilRemoteStreamStartFlowing, 3000);
};

/***************************************************************************************************
 *                                Managing rooms
 ***************************************************************************************************/
var Room = {
    /* ---------- Create a new room ---------- */
    createRoom: function (isChecked, partnerEmail) {

        if (!global.clientStream) {
            alert(global.mediaAccessAlertMessage);
            return;
        }

        hideListsAndBoxes();

        var data = {
            roomName: global.roomName.validate(),
            ownerName: global.userName.validate()
        };

        if (isChecked) data.partnerEmail = partnerEmail.validate();

        $.ajax('/WebRTC/CreateRoom', {
            method: 'POST',
            data: data,
            success: function (response) {
                if (response !== false) {
                    global.roomToken = response.roomToken;
                    global.userToken = response.ownerToken;

                    document.title = 'Created room: ' + global.roomName;

                    Room.waitForParticipant();
                }
            }
        });
    },
    /* ---------- Join a room ---------- 
     * Now it call a var named userASPName defined in the page index.
     */
    joinRoom: function (element) {
        if (!global.clientStream) {
            alert(global.mediaAccessAlertMessage);
            return;
        }

        hideListsAndBoxes();

        var data = {
            roomToken: element.id,
            participant: userASPName
        };

        var email = $('#create-room').attr('data-email');
        if (email.length) data.partnerEmail = email.validate();

        $.ajax('/WebRTC/JoinRoom', {
            method: 'POST',
            data: data,
            success: function (response) {
                if (response != false) {
                    global.userToken = response.participantToken;

                    $('footer').html('Connected with ' + response.friend + '!');
                    document.title = 'Connected with ' + response.friend + '!';

                    RTC.checkRemoteICE();

                    setTimeout(function () {
                        RTC.waitForOffer();
                    }, 3000);
                }
            }
        });
    },
    /* ---------- Waiting for some participant ---------- */
    waitForParticipant: function () {
        $('footer').html('Waiting for someone to participate.');
        document.title = 'Waiting for someone to participate.';

        var data = {
            roomToken: global.roomToken,
            ownerToken: global.userToken
        };

        $.ajax('/WebRTC/GetParticipant', {
            method: 'POST',
            data: data,
            success: function (response) {
                if (response !== false) {
                    global.participant = response.participant;

                    $('footer').html('Connected with ' + response.participant + '!');
                    document.title = 'Connected with ' + response.participant + '!';

                    RTC.createOffer();
                } else {
                    $('footer').html('<img src="/images/loader.gif">');
                    setTimeout(Room.waitForParticipant, 3000);
                }
            }
        });
    }
};

/* ---------- Getting available rooms ---------- */
function getAvailableRooms() {
    if (!global.isGetAvailableRoom) return;

    var data = {};
    if (global.searchPrivateRoom) data.partnerEmail = global.searchPrivateRoom;

    $.ajax('/WebRTC/SearchPublicRooms', {
        data: data,
        method: 'post',
        success: function (response) {
            if (!global.searchPrivateRoom) {
                /*
                $('#active-rooms').html(response.publicActiveRooms);
                $('#available-rooms').html(response.availableRooms);
                $('#private-rooms').html(response.privateAvailableRooms);
                */
            }

            document.title = response.availableRooms + ' available public rooms, ' + response.publicActiveRooms + ' active public rooms and ' + response.privateAvailableRooms + ' available private rooms';

            var rooms = response.rooms;
            if (!rooms.length) {
                $('aside').html('<div><h2 style="font-size:1.2em;">Waiting for a conference!</h2><small>You must create a conference or wait.</small></div>');
            } else {
                var html = '';
                rooms.forEach(function (room) {
                    /*
                     * room.roomName
                     * room.ownerName
                     */
                    html += '<div><h2>Incoming call!</h2><small>From ' + room.ownerName + '</small><span id="' + room.roomToken + '" class="send-button hang-button">Answer the call</span></div>';
                });

                $('aside').html(html);
                $('.hang-button').bind('click', function () {
                    global.roomToken = this.id;
                    Room.joinRoom(this);
                });
            }
            setTimeout(getAvailableRooms, 10000);
        }
    });
}

/****************************************************************************************************
 *                                      Binding des boutons      
 ****************************************************************************************************/
/* ---------- Bind the button create a room ---------- 
 * It create a room and join the room.
 */
$('#create-room').bind('click', function () {

    var fullName = $(this).attr('data-full-name');
    var roomName = $(this).attr('data-room-name');
    var partnerEmail = $(this).attr('data-partner-email');

    if (fullName.length <= 0) {
        alert('An error occured with your full name.');
        return;
    }

    if (roomName.length <= 0) {
        alert('An error occured with your room name.');
        return;
    }

    var isChecked = $(this).attr('data-is-private');

    if (isChecked == "true" && partnerEmail.length <= 0) {
        alert('An error occured with your partner identifier.');
        return;
    }

    global.userName = fullName;
    global.roomName = roomName;

    Room.createRoom(isChecked, partnerEmail);
});

/* ---------- Bind the button search a private room ---------- 
 * We must delete this at the and of the integration!
 */
$('#search-room').bind('click', function () {
    var email = $('input#email');
    if (!email.value.length) {
        alert('Please enter the email or unique token/word that your partner given you.');
        email.focus();
        return;
    }

    global.searchPrivateRoom = email.value;

    $('.private-room').hide();
    $('footer').html('Searching private room for: ' + global.searchPrivateRoom);
});

/****************************************************************************************************
 *                                    Capture des périphériques
 ****************************************************************************************************/
/* ---------- Capture the camera ---------- */
function captureCamera() {
    navigator.getUserMedia({
        audio: true,
        video: true
    },
        function (stream) {

            $('#client-video')[0].srcObject = stream;

            global.clientStream = stream;

            $('#client-video')[0].play();
        },
        function () {
            //location.reload();
        });
}

/* ---------- It should capture the screen ---------- */
function captureScreen() {

}

/****************************************************************************************************
 *                                    Getting stats
 ****************************************************************************************************/
/* ---------- Get the stats ---------- */
function getStats() {
    $.ajax('/WebRTC/Stats', {
        method: 'post',
        success: function (response) {
            /*
            $('#number-of-rooms').html(response.numberOfRooms);
            $('#number-of-public-rooms').html(response.numberOfPublicRooms);
            $('#number-of-private-rooms').html(response.numberOfPrivateRooms);
            $('#number-of-empty-rooms').html(response.numberOfEmptyRooms);
            $('#number-of-full-rooms').html(response.numberOfFullRooms);

            $('.stats').css('top', '9.5%');
            */
        }
    });
}

/****************************************************************************************************
 *                                           Débug
 ****************************************************************************************************/
/* ----------  ---------- */
function onSdpError(e) {
    console.error(e);
}

/****************************************************************************************************
 *                                      Calling functions!
 ****************************************************************************************************/

/* ---------- Let capture the camera ---------- */
captureCamera();

/* ---------- Let get the available rooms ---------- */
getAvailableRooms();

/* ---------- Let get all stats ---------- */
getStats();