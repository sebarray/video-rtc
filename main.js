

const firebaseConfig = {
  apiKey: "AIzaSyDEVNzetPPloujO3y6Ut822qoKfaljVjtM",
  authDomain: "webrtc-65b18.firebaseapp.com",
  projectId: "webrtc-65b18",
  storageBucket: "webrtc-65b18.appspot.com",
  messagingSenderId: "652768808477",
  appId: "1:652768808477:web:199bc9d4a678c6b43240f4"
};

if(!firebase.apps.length){
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();






const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

let pc = new RTCPeerConnection(servers);
let localStream= null;
let remoteStream = null;

const webcamButton = document.getElementById ( 'webcamButton' ) ;
const webcamVideo = document.getElementById ( 'webcamVideo' ) ;
const callButton = document.getElementById ( 'callButton' ) ;
const callInput = document.getElementById ( 'callInput' ) ;
const answerButton = document.getElementById ( 'answerButton' ) ;
const remoteVideo = document.getElementById ( 'remoteVideo' ) ;
const hangupButton = document.getElementById ( 'hangupButton' ) ;


webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  remoteStream=  new MediaStream();
  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
  });
  pc.ontrack= event=>{
    event.streams[0].getTracks().forEach(track=>{
        remoteStream.addTrack(track);
    });
  };

  // Show stream in HTML video
  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject=remoteStream;
}





callButton.onclick = async () => {
  // Reference Firestore collections for signaling
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');
  
    callInput.value = callDoc.id;
  
    // Get candidates for caller, save to db
    pc.onicecandidate = event => {
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };
  
    // Create offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
  
    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };
  
    await callDoc.set({ offer });
  
    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDescription);
      }
    });
  
    // Listen for remote ICE candidates
    answerCandidates.onSnapshot(snapshot => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
  }




  answerButton.onclick = async () => {
    const callId = callInput.value;
    const callDoc = firestore.collection('calls').doc(callId);
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');
  
    pc.onicecandidate = event => {
      event.candidate && answerCandidates.add(event.candidate.toJSON());
    };
  
    // Fetch data, then set the offer & answer
  
    const callData = (await callDoc.get()).data();
  
    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
  
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);
  
    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };
  
    await callDoc.update({ answer });
  
    // Listen to offer candidates
  
    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        console.log(change)
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };
