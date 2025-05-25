// src/App.js (or App.jsx)
import React, { useState, useEffect, useRef, createContext, useContext, useCallback, useMemo } from 'react';
import { auth, db } from './firebaseConfig.js'; 
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  GoogleAuthProvider, 
  signInWithPopup,    
  updateProfile as updateAuthProfile, 
  EmailAuthProvider, 
  reauthenticateWithCredential, 
  updatePassword,
  deleteUser as deleteFirebaseAuthUser
} from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
  getDocs, 
  doc,
  setDoc,
  updateDoc, 
  deleteDoc,
  writeBatch,
  getDoc, 
  limit, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { 
  LogOut, MessageSquareText, Send, AlertTriangle, UserPlus, LogIn, Users, 
  MessageCircle, Search, ChevronLeft, Paperclip, Smile, 
  MoreVertical, Settings, User, ChevronDown, Edit3, Bell, CheckCircle, 
  XCircle, Image as ImageIcon, FileText as FileTextIcon, Save, X, Palette, 
  UserPlus2, Users2, Hash, ShieldCheck, Trash2, Moon, Sun, UploadCloud, ArrowLeft, PaintBucket, Check, 
  Volume2, VolumeX, ThumbsUp, UserCheck, UserX, Volume1, Eye, UserMinus, CircleUserRound, BadgeHelp, CircleSlash,
  Gift, Award, SlidersHorizontal // For Admin Portal icon
} from 'lucide-react';

// --- App ID for Firestore Path ---
const APP_NAMESPACE_ID = "skab-chat-v1.15-admin-portal"; // Updated version

// --- Helper to generate discriminator ---
const generateDiscriminator = () => String(Math.floor(1000 + Math.random() * 9000));

// --- Badge Definitions ---
const BADGE_DEFINITIONS = {
  Dev: { name: 'Developer', imageSrc: '/badges/Dev.svg', description: 'Core Contributor & Developer' },
  Premium: { name: 'Premium User', imageSrc: '/badges/Premium.svg', description: 'Valued Premium Supporter' },
  AlphaOG: { name: 'Alpha OG', imageSrc: '/badges/AlphaOG.svg', description: 'Early Alpha Tester & Pioneer' },
  Admin: { name: 'Administrator', imageSrc: '/badges/Admin.svg', description: 'Site Administrator (Grants Special Privileges)' }, 
};
const ASSIGNABLE_BADGES = ['Dev', 'Premium', 'AlphaOG']; 


// --- Google Icon SVG ---
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    <path d="M1 1h22v22H1z" fill="none"/>
  </svg>
);

// --- Context for Authentication and App State ---
const AppContext = createContext(null);
const useAppContext = () => useContext(AppContext);

const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [systemNotification, setSystemNotification] = useState(null); 
  const [appNotifications, setAppNotifications] = useState([]); 
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [currentChat, setCurrentChat] = useState(null);
  const [view, setView] = useState('login'); 
  const [modalView, setModalView] = useState(null); 
  const [modalData, setModalData] = useState(null); 
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [isNotificationsPanelOpen, setIsNotificationsPanelOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem(`${APP_NAMESPACE_ID}-theme`) || 'default');
  
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [hasInteracted, setHasInteracted] = useState(false); 
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem(`${APP_NAMESPACE_ID}-soundEnabled`) === 'true');
  const [friends, setFriends] = useState([]); 
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] }); 
  const [blockedUsers, setBlockedUsers] = useState([]);

  const notificationSoundRef = useRef(null);
  const messageSoundRef = useRef(null); 

  const attemptPlaySound = useCallback((audioRef, volume = 0.5, loop = false) => {
    if (audioRef && audioRef.current && hasInteracted && soundEnabled) { 
      audioRef.current.volume = volume;
      audioRef.current.loop = loop; 
      audioRef.current.play().catch(e => console.warn("Sound autoplay prevented:", e.message, audioRef.current?.src));
    } else if (!hasInteracted && soundEnabled) { 
      console.warn("Audio play attempted before user interaction for:", audioRef?.current?.src);
    }
  }, [hasInteracted, soundEnabled]);

  useEffect(() => {
    const enableAudioContext = () => {
      if (!hasInteracted) {
        setHasInteracted(true);
        const unlockAudio = async (audioElement) => {
          if (audioElement?.paused) { try { await audioElement.play(); audioElement.pause(); } catch (err) { /* console.warn("Audio unlock failed", err) */ } }
        };
        if (notificationSoundRef.current) unlockAudio(notificationSoundRef.current);
        if (messageSoundRef.current) unlockAudio(messageSoundRef.current);
      }
      window.removeEventListener('click', enableAudioContext);
      window.removeEventListener('keydown', enableAudioContext);
    };
    if (soundEnabled && !hasInteracted) { 
        window.addEventListener('click', enableAudioContext, { once: true });
        window.addEventListener('keydown', enableAudioContext, { once: true });
    }
    return () => {
      window.removeEventListener('click', enableAudioContext);
      window.removeEventListener('keydown', enableAudioContext);
    };
  }, [hasInteracted, soundEnabled]);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'theme-dark', 'theme-default'); 
    localStorage.setItem(`${APP_NAMESPACE_ID}-theme`, theme);
    document.documentElement.classList.add(`theme-${theme}`);
    if (theme === 'dark') { document.documentElement.classList.add('dark'); }
  }, [theme]);

  const displaySystemNotification = useCallback((message, type = 'error', duration = 5000, playSound = false) => {
    setSystemNotification({ message, type, id: Date.now() });
    if (playSound && (type === 'info' || type === 'success')) { 
        attemptPlaySound(notificationSoundRef, 0.5);
    }
    setTimeout(() => setSystemNotification(null), duration);
  }, [attemptPlaySound]);

  const requestNotificationPerm = useCallback(async () => {
    if (!("Notification" in window)) { displaySystemNotification("This browser does not support desktop notifications.", "info"); return; }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') { new Notification("Skab Notifications Enabled", { body: "You will now receive notifications!", icon: '/logo.png' }); } 
      else { displaySystemNotification("Notification permission denied. You can enable it in browser settings.", "info"); }
    }
  }, [displaySystemNotification]);

  const addAppNotification = useCallback(async (targetUserId, type, actorInfo, messageText, link = null) => {
    if (!targetUserId) return;
    try {
      await addDoc(collection(db, `users/${targetUserId}/user_notifications`), {
        type: type, actorUid: actorInfo.uid, actorName: actorInfo.displayName, actorPhotoURL: actorInfo.photoURL,
        message: messageText, link: link, timestamp: serverTimestamp(), isRead: false,
      });
    } catch (error) { console.error("Error adding app notification:", error); }
  }, []);

  const handleUserAction = useCallback(async (action, targetUser) => {
    if (!user || !targetUser || user.uid === targetUser.uid) return;
    const friendRequestQuery = (from, to) => query(collection(db, "friend_requests"), where("fromUid", "==", from), where("toUid", "==", to), where("status", "==", "pending"));
    
    try {
      if (action === 'addFriend') {
        const friendSnap = await getDoc(doc(db, `users/${user.uid}/friends`, targetUser.uid));
        if (friendSnap.exists()) { displaySystemNotification("You are already friends with this user.", 'info'); return; }
        const existingSentSnap = await getDocs(friendRequestQuery(user.uid, targetUser.uid));
        if (!existingSentSnap.empty) { displaySystemNotification("Friend request already sent.", 'info'); return; }
        const existingReceivedSnap = await getDocs(friendRequestQuery(targetUser.uid, user.uid));
        if (!existingReceivedSnap.empty) { 
          // Automatically accept if there's an incoming request
          return handleUserAction('acceptFriend', targetUser); 
        }

        const frRef = doc(collection(db, "friend_requests"));
        await setDoc(frRef, {
            fromUid: user.uid, fromName: user.displayName, fromPhotoURL: user.photoURL, fromDiscriminator: user.discriminator,
            toUid: targetUser.uid, toName: targetUser.displayName, toPhotoURL: targetUser.photoURL, toDiscriminator: targetUser.discriminator,
            status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        addAppNotification(targetUser.uid, 'friend_request_received', 
          { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }, 
          `${user.displayName} sent you a friend request.`,
          `/profile/${user.uid}` 
        );
        displaySystemNotification(`Friend request sent to ${targetUser.displayName || targetUser.email}!`, 'success', 3000, true);

      } else if (action === 'acceptFriend') {
        const requestSnap = await getDocs(friendRequestQuery(targetUser.uid, user.uid));
        if (requestSnap.empty) { displaySystemNotification("Friend request not found or already handled.", 'info'); return; }
        const requestDoc = requestSnap.docs[0];

        const batch = writeBatch(db);
        batch.update(requestDoc.ref, { status: 'accepted', updatedAt: serverTimestamp() });
        batch.set(doc(db, `users/${user.uid}/friends`, targetUser.uid), { friendUid: targetUser.uid, friendName: targetUser.displayName, friendPhotoURL: targetUser.photoURL, friendDiscriminator: targetUser.discriminator, status: 'accepted', friendedAt: serverTimestamp() });
        batch.set(doc(db, `users/${targetUser.uid}/friends`, user.uid), { friendUid: user.uid, friendName: user.displayName, friendPhotoURL: user.photoURL, friendDiscriminator: user.discriminator, status: 'accepted', friendedAt: serverTimestamp() });
        await batch.commit();
        
        addAppNotification(targetUser.uid, 'friend_request_accepted', 
          { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }, 
          `${user.displayName} accepted your friend request.`,
          `/profile/${user.uid}`
        );
        displaySystemNotification(`You are now friends with ${targetUser.displayName || targetUser.email}!`, 'success', 3000, true);

      } else if (action === 'declineFriend' || action === 'cancelFriendRequest') {
        const fromUID = action === 'declineFriend' ? targetUser.uid : user.uid;
        const toUID = action === 'declineFriend' ? user.uid : targetUser.uid;
        const q = query(collection(db, "friend_requests"), where("fromUid", "==", fromUID), where("toUid", "==", toUID), where("status", "==", "pending"));
        const requestSnap = await getDocs(q);
        if (requestSnap.empty) { displaySystemNotification("Friend request not found or already handled.", 'info'); return; }
        
        const batch = writeBatch(db);
        requestSnap.docs.forEach(doc => batch.delete(doc.ref)); 
        await batch.commit();
        displaySystemNotification(`Friend request ${action === 'declineFriend' ? 'declined' : 'cancelled'}.`, 'info');

      } else if (action === 'removeFriend') {
        if (!window.confirm(`Are you sure you want to remove ${targetUser.displayName} as a friend?`)) return;
        const batch = writeBatch(db);
        batch.delete(doc(db, `users/${user.uid}/friends`, targetUser.uid));
        batch.delete(doc(db, `users/${targetUser.uid}/friends`, user.uid));
        await batch.commit();
        displaySystemNotification(`${targetUser.displayName} removed from friends.`, 'success');
        if (currentChat?.id === targetUser.uid) setCurrentChat(null);

      } else if (action === 'blockUser') {
        if (!window.confirm(`Are you sure you want to block ${targetUser.displayName}? They will not be able to message you or send friend requests.`)) return;
        await setDoc(doc(db, `users/${user.uid}/blockedUsers`, targetUser.uid), {
            blockedAt: serverTimestamp(), displayName: targetUser.displayName, photoURL: targetUser.photoURL
        });
        displaySystemNotification(`${targetUser.displayName} has been blocked.`, 'success');
        if (currentChat?.id === targetUser.uid) setCurrentChat(null);
        const batch = writeBatch(db);
        batch.delete(doc(db, `users/${user.uid}/friends`, targetUser.uid));
        batch.delete(doc(db, `users/${targetUser.uid}/friends`, user.uid));
        const frQuerySent = query(collection(db, "friend_requests"), where("fromUid", "==", user.uid), where("toUid", "==", targetUser.uid));
        const frQueryReceived = query(collection(db, "friend_requests"), where("fromUid", "==", targetUser.uid), where("toUid", "==", user.uid));
        (await getDocs(frQuerySent)).docs.forEach(d => batch.delete(d.ref));
        (await getDocs(frQueryReceived)).docs.forEach(d => batch.delete(d.ref));
        await batch.commit().catch(e => console.warn("Error cleaning up relations after block:", e));

      } else if (action === 'unblockUser') {
        await deleteDoc(doc(db, `users/${user.uid}/blockedUsers`, targetUser.uid));
        displaySystemNotification(`${targetUser.displayName} has been unblocked.`, 'success');
      
      } else if (action === 'viewProfile') {
        setModalData(targetUser); setModalView('viewProfile');
      }
    } catch (error) {
      console.error(`Error performing action '${action}':`, error);
      displaySystemNotification(`Failed to ${action.replace(/([A-Z])/g, ' $1').toLowerCase()}. Error: ${error.message}`, 'error');
    }
  }, [user, displaySystemNotification, addAppNotification, currentChat, setCurrentChat, setModalData, setModalView]);

  const assignBadgesToUser = useCallback(async (targetUserId, newBadgesArray) => {
    if (!user || !user.isAdmin) {
      displaySystemNotification("You don't have permission to perform this action.", "error");
      return false;
    }
    try {
      const targetUserDocRef = doc(db, "users", targetUserId);
      await updateDoc(targetUserDocRef, {
        badges: newBadgesArray 
      });
      displaySystemNotification(`Badges updated for user.`, "success");
      if (modalData?.uid === targetUserId) {
        setModalData(prev => ({...prev, badges: newBadgesArray}));
      }
      return true;
    } catch (error) {
      console.error("Error assigning badges:", error);
      displaySystemNotification("Failed to assign badges.", "error");
      return false;
    }
  }, [user, displaySystemNotification, modalData, setModalData]);


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      let profileUnsubscribe = () => {}; 
      let notificationsUnsubscribe = () => {};
      let friendsUnsubscribe = () => {};
      let friendRequestsToUnsubscribe = () => {};
      let friendRequestsFromUnsubscribe = () => {};
      let blockedUsersUnsubscribe = () => {};

      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        profileUnsubscribe = onSnapshot(userDocRef, 
          async (docSnap) => { 
            let discriminator = "0000", needsUpdate = false;
            let currentPhotoURL = firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || firebaseUser.email.split('@')[0])}&background=8B5CF6&color=FFFFFF&bold=true&rounded=true&size=128`;
            let currentDisplayName = firebaseUser.displayName || firebaseUser.email.split('@')[0];
            let currentBio = "";
            let currentBadges = [];
            let isAdmin = false;

            if (docSnap.exists()) {
              const fetchedData = docSnap.data();
              currentDisplayName = fetchedData.displayName || currentDisplayName;
              currentPhotoURL = fetchedData.photoURL || currentPhotoURL;
              discriminator = fetchedData.discriminator;
              currentBio = fetchedData.bio || "";
              currentBadges = fetchedData.badges || [];
              isAdmin = (currentBadges || []).includes('Admin');

              if (!discriminator) { discriminator = generateDiscriminator(); needsUpdate = true; }
              
              setUser({
                uid: firebaseUser.uid, email: firebaseUser.email,
                displayName: currentDisplayName, discriminator: discriminator, photoURL: currentPhotoURL,
                status: fetchedData.status || "online", bio: currentBio, badges: currentBadges, isAdmin: isAdmin
              });

              if (needsUpdate) { 
                try { await updateDoc(userDocRef, { discriminator: discriminator, displayName: currentDisplayName, photoURL: currentPhotoURL }); } 
                catch (updateError) { console.error("Error updating user document:", updateError); }
              }
            } else { 
             discriminator = generateDiscriminator();
             try {
                await setDoc(userDocRef, {
                    uid: firebaseUser.uid, email: firebaseUser.email,
                    displayName: currentDisplayName, discriminator: discriminator, 
                    createdAt: serverTimestamp(), status: "online", photoURL: currentPhotoURL,
                    bio: "", badges: [] 
                });
                setUser({ uid: firebaseUser.uid, email: firebaseUser.email, displayName: currentDisplayName, discriminator: discriminator, photoURL: currentPhotoURL, status: "online", bio: "", badges: [], isAdmin: false });
             } catch (setDocError) { console.error("Error creating user document:", setDocError); }
            }
            if (view === 'login' && !loading) setView('chat'); // Only switch if not initial loading phase already completed
            if(loading) setLoading(false); 
          }, 
          (profileError) => {
            console.error("Error fetching user profile with onSnapshot:", profileError);
            setUser({
              uid: firebaseUser.uid, email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              discriminator: "0000", 
              photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || firebaseUser.email.split('@')[0])}&background=E0E7FF&color=7C3AED&bold=true&size=128&rounded=true`,
              status: "online", bio: "", badges: [], isAdmin: false
            });
            if (view === 'login' && !loading) setView('chat');
            if(loading) setLoading(false);
          }
        );

        const notificationsRef = collection(db, `users/${firebaseUser.uid}/user_notifications`);
        const qNotifications = query(notificationsRef, orderBy("timestamp", "desc"), limit(50));
        notificationsUnsubscribe = onSnapshot(qNotifications, (snapshot) => {
          const fetchedNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAppNotifications(fetchedNotifications);
          setUnreadNotificationCount(fetchedNotifications.filter(n => !n.isRead).length);
        }, (error) => console.error("Error fetching notifications:", error));

        const friendsCollectionRef = collection(db, `users/${firebaseUser.uid}/friends`);
        friendsUnsubscribe = onSnapshot(query(friendsCollectionRef, where("status", "==", "accepted")), (snapshot) => {
            setFriends(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => console.error("Error fetching friends:", error));
        
        const frToRef = query(collection(db, "friend_requests"), where("toUid", "==", firebaseUser.uid), where("status", "==", "pending"));
        friendRequestsToUnsubscribe = onSnapshot(frToRef, snapshot => {
            setFriendRequests(prev => ({ ...prev, incoming: snapshot.docs.map(d => ({id: d.id, ...d.data()})) }));
        }, err => console.error("Error fetching incoming friend requests:", err));

        const frFromRef = query(collection(db, "friend_requests"), where("fromUid", "==", firebaseUser.uid), where("status", "==", "pending"));
        friendRequestsFromUnsubscribe = onSnapshot(frFromRef, snapshot => {
            setFriendRequests(prev => ({ ...prev, outgoing: snapshot.docs.map(d => ({id: d.id, ...d.data()})) }));
        }, err => console.error("Error fetching outgoing friend requests:", err));

        const blockedUsersRef = collection(db, `users/${firebaseUser.uid}/blockedUsers`);
        blockedUsersUnsubscribe = onSnapshot(blockedUsersRef, (snapshot) => {
            setBlockedUsers(snapshot.docs.map(doc => doc.id)); 
        }, (error) => console.error("Error fetching blocked users:", error));

      } else {
        setUser(null); setView('login'); setCurrentChat(null); setLoading(false);
        setAppNotifications([]); setUnreadNotificationCount(0); setFriends([]); setFriendRequests({ incoming: [], outgoing: [] }); setBlockedUsers([]);
      }
      return () => {
        profileUnsubscribe(); notificationsUnsubscribe(); friendsUnsubscribe(); 
        friendRequestsToUnsubscribe(); friendRequestsFromUnsubscribe(); blockedUsersUnsubscribe();
      }; 
    });
    return () => unsubscribeAuth(); 
  }, [view, loading]); // Simplified dependency array for the main auth effect.
  
  const contextValue = useMemo(() => ({
    user, setUser, loading, systemNotification, displaySystemNotification, view, setView, currentChat, setCurrentChat, isMobileView,
    isNotificationsPanelOpen, setIsNotificationsPanelOpen, appNotifications, setAppNotifications, unreadNotificationCount, setUnreadNotificationCount, addAppNotification,
    theme, setTheme, notificationPermission, requestNotificationPerm, hasInteracted, setHasInteracted, 
    soundEnabled, setSoundEnabled, attemptPlaySound, messageSoundRef, notificationSoundRef,
    friends, friendRequests, blockedUsers, setBlockedUsers, 
    modalView, setModalView, modalData, setModalData, 
    handleUserAction, assignBadgesToUser 
  }), [user, loading, systemNotification, displaySystemNotification, view, currentChat, isMobileView, isNotificationsPanelOpen, appNotifications, unreadNotificationCount, addAppNotification, theme, notificationPermission, requestNotificationPerm, hasInteracted, soundEnabled, attemptPlaySound, friends, friendRequests, blockedUsers, modalView, modalData, handleUserAction, assignBadgesToUser ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <audio ref={notificationSoundRef} src="/audio/notification.mp3" preload="auto"/> 
      <audio ref={messageSoundRef} src="/audio/message.mp3" preload="auto" />
    </AppContext.Provider>
  );
};

const AuthForm = () => { 
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { displaySystemNotification } = useAppContext();

  const handleGoogleSignIn = useCallback(async () => {
    setIsGoogleLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const gUser = result.user;
      const userDocRef = doc(db, "users", gUser.uid);
      const userDocSnapshot = await getDoc(userDocRef); 
      
      if (!userDocSnapshot.exists()) { 
        const discriminator = generateDiscriminator();
        await setDoc(userDocRef, {
          uid: gUser.uid, email: gUser.email,
          displayName: gUser.displayName || gUser.email.split('@')[0],
          discriminator: discriminator,
          photoURL: gUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(gUser.displayName || gUser.email.split('@')[0])}&background=8B5CF6&color=FFFFFF&bold=true&rounded=true&size=128`,
          createdAt: serverTimestamp(), status: "online", bio: "", badges: []
        });
      }
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      displaySystemNotification(error.message || "Failed to sign in with Google. Please try again.");
    } finally { setIsGoogleLoading(false); }
  }, [displaySystemNotification]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault(); setIsLoading(true);
    if (!isLogin && password !== confirmPassword) { displaySystemNotification("Passwords do not match."); setIsLoading(false); return; }
    if (!isLogin && !displayName.trim()) { displaySystemNotification("Display name is required for registration."); setIsLoading(false); return; }
    try {
      if (isLogin) { await signInWithEmailAndPassword(auth, email, password); } 
      else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const userDocRef = doc(db, `users/${userCredential.user.uid}`);
        const discriminator = generateDiscriminator();
        await setDoc(userDocRef, {
          uid: userCredential.user.uid, email: userCredential.user.email, displayName: displayName.trim(),
          discriminator: discriminator, createdAt: serverTimestamp(), status: "online", bio: "", badges: [],
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName.trim())}&background=8B5CF6&color=FFFFFF&bold=true&rounded=true&size=128`
        });
      }
    } catch (err) {
      console.error("Auth error:", err);
      let fm = "Authentication failed. Please try again.";
      if (err.code) {
        switch (err.code) {
          case 'auth/email-already-in-use': fm = "This email is already registered. Try logging in."; break;
          case 'auth/weak-password': fm = "Password is too weak (min. 6 characters)."; break;
          case 'auth/invalid-email': fm = "The email address is not valid."; break;
          case 'auth/user-not-found': case 'auth/wrong-password': case 'auth/invalid-credential': fm = "Invalid email or password."; break;
          default: fm = err.message; 
        }
      }
      displaySystemNotification(fm);
    } finally { setIsLoading(false); }
  }, [isLogin, email, password, displayName, confirmPassword, displaySystemNotification]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-50 to-indigo-100 p-4 selection:bg-purple-500 selection:text-white">
      <div className="bg-white p-8 sm:p-12 rounded-xl shadow-2xl w-full max-w-lg transform transition-all hover:shadow-3xl">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Skab Logo" className="w-20 h-20 mx-auto mb-3 rounded-full object-contain" onError={(e) => { e.target.style.display='none'; const placeholder = e.target.nextSibling; if(placeholder) placeholder.style.display='block'; }}/>
          <div style={{display: 'none'}}><MessageSquareText size={56} className="mx-auto text-purple-600 mb-3" /></div>
          <h1 className="text-4xl font-bold text-slate-800">Skab</h1>
          <p className="text-slate-500 mt-2 text-base">{isLogin ? 'Welcome back! Sign in to continue.' : 'Create your account to start chatting.'}</p>
        </div>
        <button onClick={handleGoogleSignIn} disabled={isGoogleLoading || isLoading} className="w-full flex justify-center items-center py-3.5 px-4 mb-6 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
          {isGoogleLoading ? <svg className="animate-spin h-5 w-5 mr-2 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <GoogleIcon />} Sign in with Google
        </button>
        <div className="relative mb-6"><div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-slate-300" /></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-500">Or {isLogin ? 'sign in' : 'sign up'} with email</span></div></div>
        <form onSubmit={handleSubmit} className="space-y-6">
          {!isLogin && (<div><label htmlFor="displayName" className="block text-sm font-medium text-slate-700 mb-1.5">Display Name</label><input id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required={!isLogin} className="w-full px-4 py-3.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors placeholder-slate-400" placeholder="Your Name"/></div>)}
          <div><label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label><input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="w-full px-4 py-3.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors placeholder-slate-400" placeholder="you@example.com"/></div>
          <div><label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">Password</label><input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={isLogin ? "current-password" : "new-password"} className="w-full px-4 py-3.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors placeholder-slate-400" placeholder="••••••••"/></div>
          {!isLogin && (<div><label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label><input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required={!isLogin} autoComplete="new-password" className="w-full px-4 py-3.5 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors placeholder-slate-400" placeholder="••••••••"/></div>)}
          <button type="submit" disabled={isLoading || isGoogleLoading} className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-base font-semibold text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 ease-in-out transform hover:scale-[1.01] active:scale-[0.99]">
            {isLoading ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : (isLogin ? <LogIn size={20} className="mr-2"/> : <UserPlus size={20} className="mr-2"/>)} {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-slate-500">{isLogin ? "Don't have an account?" : 'Already have an account?'} <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-purple-600 hover:text-purple-500 hover:underline ml-1 focus:outline-none">{isLogin ? 'Sign Up' : 'Sign In'}</button></p>
      </div>
    </div>
  );
};


const UserListItem = React.memo(({ contact, onClick, isActive, onUserAction, isFriend, hasPendingRequestFrom, hasSentRequestTo, isBlocked, itemType }) => {
  const { user } = useAppContext();
  const [showSubMenu, setShowSubMenu] = useState(false);
  const subMenuRef = useRef(null);
  const hasUnread = contact.lastMessage && contact.lastMessage.userId !== user?.uid && !isActive;

  useEffect(() => {
    const handleClickOutside = (event) => { if (subMenuRef.current && !subMenuRef.current.contains(event.target)) { setShowSubMenu(false); }};
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = (e) => { if (showSubMenu || e.target.closest('button.user-action-button')) { return; } onClick(); };

  let itemContextSpecificClass = '';
  if (itemType === 'incomingRequest') itemContextSpecificClass = 'bg-green-50 hover:bg-green-100 border-l-4 border-green-500';
  else if (itemType === 'outgoingRequest') itemContextSpecificClass = 'bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500';
  else if (itemType === 'friend') itemContextSpecificClass = 'hover:bg-purple-50';
  else itemContextSpecificClass = 'hover:bg-purple-50'; // Default for 'People' tab

  return (
    <div 
      onClick={handleItemClick} 
      className={`flex items-center p-3.5 cursor-pointer rounded-xl transition-colors duration-150 mx-3 my-1.5 group relative ${isActive ? 'bg-purple-100 shadow-md' : itemContextSpecificClass}`}
    >
      <div className="relative mr-4">
        <img 
          src={contact.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.displayName || contact.email)}&background=${isActive ? '8B5CF6' : 'EDE9FE'}&color=${isActive ? 'FFFFFF' : '6D28D9'}&bold=true&size=48&rounded=true`} 
          alt={contact.displayName || 'User'} 
          className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-lg" 
          onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.displayName?.[0] || 'U')}&background=D1D5DB&color=4B5563&bold=true&size=48&rounded=true`; }}
        />
        {hasUnread && (<span className="absolute top-0 right-0 block h-3 w-3 rounded-full ring-2 ring-white bg-red-500" title="Unread messages"></span>)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <p className={`font-semibold text-sm truncate ${isActive ? 'text-purple-700' : 'text-slate-800 group-hover:text-purple-600'}`}>
            {contact.displayName || contact.email.split('@')[0]}
            <span className="text-slate-400 font-normal text-xs ml-1">#{contact.discriminator || '0000'}</span>
          </p>
        </div>
        {itemType === 'incomingRequest' && <p className="text-xs text-green-600 font-medium mt-0.5">Wants to be your friend</p>}
        {itemType === 'outgoingRequest' && <p className="text-xs text-yellow-600 font-medium mt-0.5">Friend request sent</p>}
        {itemType !== 'incomingRequest' && itemType !== 'outgoingRequest' && contact.lastMessage && (
          <p className={`text-xs truncate mt-0.5 ${isActive ? 'text-purple-600 font-medium' : 'text-slate-500 group-hover:text-slate-600'}`}>
            {contact.lastMessage.text.length > 30 ? `${contact.lastMessage.text.substring(0, 30)}...` : contact.lastMessage.text}
          </p>
        )}
        {itemType !== 'incomingRequest' && itemType !== 'outgoingRequest' && !contact.lastMessage && <p className="text-xs text-slate-400 italic mt-0.5">No recent activity</p>}
      </div>
      {onUserAction && !isActive && (
        <div className="relative ml-2">
          <button onClick={(e) => { e.stopPropagation(); setShowSubMenu(prev => !prev); }} title="More actions" className="user-action-button p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-100 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical size={18} /></button>
          {showSubMenu && (
            <div ref={subMenuRef} className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-10">
              <button onClick={(e) => { e.stopPropagation(); onUserAction('viewProfile', contact); setShowSubMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"><CircleUserRound size={16} className="mr-2"/> View Profile</button>
              {isFriend && <button onClick={(e) => { e.stopPropagation(); onUserAction('removeFriend', contact); setShowSubMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"><UserX size={16} className="mr-2"/> Remove Friend</button>}
              {!isFriend && !hasPendingRequestFrom && !hasSentRequestTo && <button onClick={(e) => { e.stopPropagation(); onUserAction('addFriend', contact); setShowSubMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"><UserPlus2 size={16} className="mr-2"/> Add Friend</button>}
              {hasPendingRequestFrom && <button onClick={(e) => { e.stopPropagation(); onUserAction('acceptFriend', contact); setShowSubMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center"><UserCheck size={16} className="mr-2"/> Accept Request</button>}
              {hasPendingRequestFrom && <button onClick={(e) => { e.stopPropagation(); onUserAction('declineFriend', contact); setShowSubMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"><UserX size={16} className="mr-2"/> Decline Request</button>}
              {hasSentRequestTo && <button onClick={(e) => { e.stopPropagation(); onUserAction('cancelFriendRequest', contact); setShowSubMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 flex items-center"><UserX size={16} className="mr-2"/> Cancel Request</button>}
              {!isBlocked && <button onClick={(e) => { e.stopPropagation(); onUserAction('blockUser', contact); setShowSubMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"><CircleSlash size={16} className="mr-2"/> Block User</button>}
              {isBlocked && <button onClick={(e) => { e.stopPropagation(); onUserAction('unblockUser', contact); setShowSubMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center"><CircleSlash size={16} className="mr-2"/> Unblock User</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
});


const ChatSidebar = () => { 
  const { user, setCurrentChat, currentChat, displaySystemNotification, setView, setIsNotificationsPanelOpen, unreadNotificationCount, friends, friendRequests, blockedUsers, setModalView, setModalData, handleUserAction } = useAppContext(); 
  const [allUsers, setAllUsers] = useState([]); 
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('People'); 

  useEffect(() => {
    if (!db || !user) return;
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("uid", "!=", user.uid), orderBy("displayName")); 
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), type: 'dm' }))
        .filter(u => !blockedUsers.includes(u.uid)); 
      setAllUsers(fetchedUsers);
    }, (err) => {
      console.error("Error fetching users:", err);
      if (err.code === 'failed-precondition') displaySystemNotification("Could not load users: Firestore index missing.");
      else if (err.code === 'permission-denied') displaySystemNotification("Could not load users: Permission denied.");
      else displaySystemNotification("Could not load users list.");
    });
    return () => unsubscribe();
  }, [db, user, displaySystemNotification, blockedUsers]);

  const listToDisplay = useMemo(() => {
    let sourceList = [];
    if (activeTab === 'People') {
        sourceList = allUsers; 
    } else if (activeTab === 'Friends') { 
        const incomingReqs = (friendRequests.incoming || []).map(req => ({
            ...req, uid: req.fromUid, id: req.id, displayName: req.fromName, photoURL: req.fromPhotoURL, discriminator: req.fromDiscriminator, type: 'dm', itemType: 'incomingRequest'
        }));
        const outgoingReqs = (friendRequests.outgoing || []).map(req => ({
             ...req, uid: req.toUid, id: req.id, displayName: req.toName, photoURL: req.toPhotoURL, discriminator: req.toDiscriminator, type: 'dm', itemType: 'outgoingRequest'
        }));
        const currentFriends = friends.map(f => ({
            uid: f.friendUid, id: f.friendUid, displayName: f.friendName, photoURL: f.friendPhotoURL, discriminator: f.friendDiscriminator, type: 'dm', itemType: 'friend'
        }));
        sourceList = [...incomingReqs, ...outgoingReqs, ...currentFriends];
    } else if (activeTab === 'Groups') {
        sourceList = []; 
    }

    if (!searchTerm.trim()) return sourceList;
    return sourceList.filter(contact => {
      const nameMatch = (contact.displayName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const emailMatch = (contact.email || '').toLowerCase().includes(searchTerm.toLowerCase()); 
      const fullTag = `${contact.displayName || ''}#${contact.discriminator || ''}`.toLowerCase();
      const tagMatch = fullTag.includes(searchTerm.toLowerCase());
      return nameMatch || emailMatch || tagMatch;
    });
  }, [allUsers, friends, friendRequests, searchTerm, activeTab]);

  const selectChat = useCallback((contact) => {
    if (blockedUsers.includes(contact.uid)) { displaySystemNotification("Cannot open chat with a blocked user.", "info"); return; }
    setCurrentChat({
      id: contact.uid, type: 'dm',
      name: `${contact.displayName || contact.email?.split('@')[0]}#${contact.discriminator || '0000'}`,
      rawName: contact.displayName || contact.email?.split('@')[0], 
      discriminator: contact.discriminator || '0000', 
      photoURL: contact.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.displayName || contact.email)}&background=random&color=fff&bold=true&size=48&rounded=true`
    });
  }, [setCurrentChat, blockedUsers, displaySystemNotification]);

  const sidebarTabs = [
    { name: 'People', icon: Users, id: 'People' },
    { name: 'Friends', icon: UserCheck, id: 'Friends', count: (friendRequests.incoming || []).length }, 
  ];

  return (
    <div className="w-full md:w-[360px] lg:w-[400px] bg-white border-r border-slate-200 flex flex-col h-full shadow-lg md:rounded-l-xl">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => setView('settings')}>
            <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || user?.email)}&background=8B5CF6&color=FFFFFF&bold=true&size=40&rounded=true`} alt="My Avatar" className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 group-hover:border-purple-500 transition-all shadow-sm" onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName?.[0] || 'M')}&background=D1D5DB&color=4B5563&bold=true&size=40&rounded=true`; }}/>
            <div>
              <h2 className="font-semibold text-slate-800 text-lg group-hover:text-purple-600 transition-colors -mb-0.5">{user?.displayName?.split(' ')[0] || user?.email?.split('@')[0]}</h2>
              <p className="text-xs text-slate-500 group-hover:text-purple-500">#{user?.discriminator || '0000'}</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <button onClick={() => setIsNotificationsPanelOpen(true)} title="Notifications" className="text-slate-500 hover:text-purple-600 p-2 rounded-full hover:bg-purple-50 transition-colors relative">
              <Bell size={20} />
              {unreadNotificationCount > 0 && <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-red-500"></span>}
            </button>
            <button onClick={() => setView('settings')} title="Settings" className="text-slate-500 hover:text-purple-600 p-2 rounded-full hover:bg-purple-50 transition-colors"><Settings size={20} /></button>
            <button onClick={() => { firebaseSignOut(auth); setCurrentChat(null); }} title="Sign Out" className="text-slate-500 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition-colors"><LogOut size={20} /></button>
          </div>
        </div>
        <div className="relative">
          <input type="text" placeholder="Search name or name#1234..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 text-sm bg-slate-100 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-slate-700 placeholder-slate-500 transition-colors"/>
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="mt-5 flex items-center justify-between border border-slate-200 rounded-lg p-1 bg-slate-100">
          {sidebarTabs.map(tab => ( 
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 flex items-center justify-center space-x-1.5 ${activeTab === tab.id ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-800'}`}>
              <tab.icon size={16} />
              <span>{tab.name}</span>
              {tab.count > 0 && <span className="bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{tab.count > 9 ? '9+' : tab.count}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
        {listToDisplay.length > 0 ? (
          listToDisplay.map(contact => (
            <UserListItem
              key={contact.id || contact.uid} contact={contact}
              onClick={() => selectChat(contact)}
              isActive={currentChat?.id === contact.uid && currentChat?.type === 'dm'}
              onUserAction={handleUserAction} 
              isFriend={friends.some(f => f.friendUid === contact.uid)}
              hasPendingRequestFrom={(friendRequests.incoming || []).some(req => req.fromUid === contact.uid)}
              hasSentRequestTo={(friendRequests.outgoing || []).some(req => req.toUid === contact.uid)}
              isBlocked={blockedUsers.includes(contact.uid)}
              itemType={contact.itemType} 
            />
          ))
        ) : (
          <p className="text-center text-sm text-slate-500 p-8">{searchTerm ? "No results match your search." : (activeTab === 'People' ? "Find people to chat with." : (activeTab === 'Friends' && (friendRequests.incoming || []).length === 0 && friends.length === 0 ? "No friends or pending requests." : `No ${activeTab.toLowerCase()} yet.`))}</p>
        )}
      </div>
    </div>
  );
};

const EMOJIS = ['😀', '😂', '😍', '🤔', '😢', '🎉', '👍', '❤️', '🔥', '💯', '🙏', '✨', '😊', '🥳', '🤩', '�', '😱', '👋', '👀', '👉', '👈', '👆', '👇', '👌', '🤷', '❤️‍🔥', '💔', '💯', '✅', '❌'];
const EmojiPicker = React.memo(({ onEmojiSelect, onOutsideClick }) => { const pickerRef = useRef(null); useEffect(() => { const handleClickOutside = (event) => { if (pickerRef.current && !pickerRef.current.contains(event.target)) { const emojiButton = document.getElementById('emoji-toggle-button'); if (emojiButton && emojiButton.contains(event.target)) return; onOutsideClick(); } }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, [onOutsideClick]); return ( <div ref={pickerRef} className="absolute bottom-full left-0 mb-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-30"> <div className="grid grid-cols-7 gap-1"> {EMOJIS.map(emoji => ( <button key={emoji} onClick={() => onEmojiSelect(emoji)} className="text-2xl p-1.5 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400" title={emoji}> {emoji} </button> ))} </div> </div> );});

const ChatMessageItem = React.memo(({ message, currentUserId }) => {
  const { displaySystemNotification } = useAppContext(); 
  const isSender = message.userId === currentUserId;
  const timestamp = message.timestamp?.toDate ? message.timestamp.toDate() : new Date();

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this message? This action cannot be undone.")) return; 
    try {
      let chatRoomId;
      if (message.chatRoomId) { chatRoomId = message.chatRoomId; } 
      else if (currentUserId && message.chatPartnerId) { chatRoomId = [currentUserId, message.chatPartnerId].sort().join('_');} 
      else if (currentUserId && !isSender && message.userId) { chatRoomId = [currentUserId, message.userId].sort().join('_'); } 
      else if (currentUserId && isSender && message.targetUserId) { chatRoomId = [currentUserId, message.targetUserId].sort().join('_'); } 
      else { throw new Error("Could not determine chat room ID for deletion."); }
      
      const messageRef = doc(db, `direct_messages/${chatRoomId}/messages`, message.id);
      await deleteDoc(messageRef);
      displaySystemNotification("Message deleted.", "success", 2000);
    } catch (error) {
      console.error("Error deleting message:", error);
      displaySystemNotification("Failed to delete message. You can only delete your own messages.", "error");
    }
  };

  return (
    <div className={`group flex mb-3 ${isSender ? 'justify-end pl-10 sm:pl-16' : 'justify-start pr-10 sm:pr-16'}`}>
      <div className={`relative py-2.5 px-4 rounded-2xl ${isSender ? 'bg-purple-600 text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none border border-slate-200'} max-w-[70%] shadow-md`}>
        {!isSender && message.userDisplayName && (<p className="text-xs font-semibold text-purple-700 mb-1">{message.userDisplayName}#{message.userDiscriminator || '0000'}</p>)}
        <p className="text-sm whitespace-pre-wrap leading-snug break-words">{message.text}</p> 
        <p className={`text-[10px] mt-1.5 ${isSender ? 'text-purple-200' : 'text-slate-400'} ${isSender ? 'text-right' : 'text-left'}`}>{timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        {isSender && ( <button onClick={handleDelete} className="absolute top-1 -right-2.5 transform translate-x-full p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" title="Delete message"><Trash2 size={14} /></button>)}
      </div>
    </div>
  );
});

const ChatWindow = () => { 
  const { user, currentChat, setCurrentChat, displaySystemNotification, isMobileView, attemptPlaySound, messageSoundRef, addAppNotification, friends, blockedUsers, setModalView, setModalData } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChatActions, setShowChatActions] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const prevMessagesLengthRef = useRef(0);
  const chatActionsRef = useRef(null);

  const isCurrentChatFriend = useMemo(() => friends.some(f => f.friendUid === currentChat?.id), [friends, currentChat]);
  const isCurrentChatBlocked = useMemo(() => blockedUsers.includes(currentChat?.id), [blockedUsers, currentChat]);

  useEffect(() => { if (messagesEndRef.current) { messagesEndRef.current.scrollIntoView({ behavior: "smooth" }); }}, [messages]);

  useEffect(() => {
    if (!db || !user || !currentChat) { setMessages([]); prevMessagesLengthRef.current = 0; return; }
    if (blockedUsers.includes(currentChat.id)) { displaySystemNotification(`You have blocked ${currentChat.name}. Unblock to chat.`, "info"); setMessages([]); return; }

    let q; let chatRoomId = '';
    if (currentChat.type === 'dm') {
      chatRoomId = [user.uid, currentChat.id].sort().join('_');
      const messagesRef = collection(db, `direct_messages/${chatRoomId}/messages`);
      q = query(messagesRef, orderBy("timestamp", "asc"));
    } else { return; }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), chatPartnerId: currentChat.id, chatRoomId: chatRoomId }));
      if (fetchedMessages.length > prevMessagesLengthRef.current && document.hasFocus()) { 
        const latestMessage = fetchedMessages[fetchedMessages.length - 1];
        if (latestMessage && latestMessage.userId !== user.uid) {
          attemptPlaySound(messageSoundRef, 0.6); 
          if (Notification.permission === 'granted' && !document.hasFocus()) {
            new Notification(`${latestMessage.userDisplayName || 'New Message'}`, {
              body: latestMessage.text.length > 50 ? latestMessage.text.substring(0, 47) + '...' : latestMessage.text,
              icon: '/logo.png', tag: chatRoomId 
            });
          }
        }
      }
      prevMessagesLengthRef.current = fetchedMessages.length;
      setMessages(fetchedMessages);
    }, (err) => { console.error(`Error fetching messages for chat ${currentChat.name} (ID: ${chatRoomId}):`, err); displaySystemNotification(`Could not load messages.`); });
    return () => unsubscribe();
  }, [db, user, currentChat, displaySystemNotification, attemptPlaySound, messageSoundRef, blockedUsers]);

  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !currentChat || isSending || newMessage.length > 2000) { 
        if(newMessage.length > 2000) displaySystemNotification("Message exceeds 2000 characters.", "error"); return; 
    }
    if (isCurrentChatBlocked) { displaySystemNotification("Cannot send message to a blocked user.", "error"); return; }
    setIsSending(true);
    const messageData = { text: newMessage, userId: user.uid, userEmail: user.email, userDisplayName: user.displayName || user.email.split('@')[0], userDiscriminator: user.discriminator || '0000', timestamp: serverTimestamp() };
    try {
      let messagesRef;
      if (currentChat.type === 'dm') {
        const chatRoomId = [user.uid, currentChat.id].sort().join('_');
        messagesRef = collection(db, `direct_messages/${chatRoomId}/messages`);
      } else { throw new Error("Invalid chat type"); }
      await addDoc(messagesRef, messageData);
      addAppNotification(currentChat.id, 'new_message', { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL }, `${user.displayName}: ${newMessage.substring(0,30)}${newMessage.length > 30 ? '...' : ''}`);
      setNewMessage(''); setShowEmojiPicker(false); if (inputRef.current) inputRef.current.focus();
    } catch (err) { console.error("Error sending message:", err); displaySystemNotification("Failed to send message."); } 
    finally { setIsSending(false); }
  }, [newMessage, user, currentChat, isSending, displaySystemNotification, addAppNotification, isCurrentChatBlocked]);

  const handleEmojiSelect = useCallback((emoji) => { setNewMessage(prev => { const newText = prev + emoji; return newText.length <= 2000 ? newText : prev; }); if (inputRef.current) inputRef.current.focus(); }, []);
  const handleGifPlaceholderClick = () => displaySystemNotification("GIF sharing coming soon!", "info", 3000);

  const handleChatAction = (action) => {
    setShowChatActions(false);
    const targetUserForAction = { uid: currentChat.id, displayName: currentChat.rawName, photoURL: currentChat.photoURL, discriminator: currentChat.discriminator };
    if (action === 'viewProfile') { setModalData(targetUserForAction); setModalView('viewProfile'); } 
    else if (action === 'removeFriend') {
        if (!window.confirm(`Are you sure you want to remove ${targetUserForAction.displayName} as a friend?`)) return;
        const removeFriendLogic = async () => {
            const batch = writeBatch(db);
            batch.delete(doc(db, `users/${user.uid}/friends`, targetUserForAction.uid));
            batch.delete(doc(db, `users/${targetUserForAction.uid}/friends`, user.uid));
            await batch.commit();
            displaySystemNotification(`${targetUserForAction.displayName} removed from friends.`, 'success');
            setCurrentChat(null); 
        };
        removeFriendLogic().catch(err => displaySystemNotification("Failed to remove friend.", "error"));
    } else if (action === 'blockUser') {
        if (!window.confirm(`Are you sure you want to block ${targetUserForAction.displayName}?`)) return;
        const blockUserLogic = async () => {
            await setDoc(doc(db, `users/${user.uid}/blockedUsers`, targetUserForAction.uid), { blockedAt: serverTimestamp(), displayName: targetUserForAction.displayName });
            displaySystemNotification(`${targetUserForAction.displayName} blocked.`, 'success');
            setCurrentChat(null);
        };
        blockUserLogic().catch(err => displaySystemNotification("Failed to block user.", "error"));
    } else if (action === 'unblockUser') {
         const unblockUserLogic = async () => {
            await deleteDoc(doc(db, `users/${user.uid}/blockedUsers`, targetUserForAction.uid));
            displaySystemNotification(`${targetUserForAction.displayName} unblocked.`, 'success');
        };
        unblockUserLogic().catch(err => displaySystemNotification("Failed to unblock user.", "error"));
    }
  };
  
  useEffect(() => { const handleClickOutside = (event) => { if (chatActionsRef.current && !chatActionsRef.current.contains(event.target)) { setShowChatActions(false); }}; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);

  if (!currentChat) { return ( <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 text-slate-600 h-full p-8 text-center md:rounded-r-xl"> <MessageCircle size={80} className="mb-6 opacity-30" /><p className="text-2xl font-medium">Welcome to Skab!</p><p className="text-md mt-1">Select a chat or a person to start messaging.</p> </div> ); }
  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-purple-50 h-full overflow-hidden md:rounded-r-xl">
      <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between space-x-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center space-x-3 min-w-0">
          {isMobileView && (<button onClick={() => setCurrentChat(null)} className="p-2 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-50 transition-colors"><ChevronLeft size={22}/></button>)}
          <img src={currentChat.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentChat.rawName || currentChat.name)}&background=random&color=fff&size=40&rounded=true`} alt={currentChat.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-sm" onError={(e) => { e.target.onerror = null; e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentChat.rawName?.[0] || currentChat.name?.[0] || 'C')}&background=D1D5DB&color=4B5563&size=40&rounded=true`; }}/>
          <div className="min-w-0"><h3 className="font-semibold text-slate-800 text-base truncate">{currentChat.name}</h3><p className={`text-xs ${isCurrentChatBlocked ? 'text-red-500' : 'text-green-500'}`}>{isCurrentChatBlocked ? 'Blocked' : 'Online'}</p></div>
        </div>
        <div className="flex items-center space-x-1.5 relative" ref={chatActionsRef}>
            <button onClick={() => setShowChatActions(prev => !prev)} className="p-2.5 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-50 transition-colors"><MoreVertical size={19}/></button>
            {showChatActions && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-30">
                    <button onClick={() => handleChatAction('viewProfile')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 flex items-center"><CircleUserRound size={16} className="mr-2.5"/> View Profile</button>
                    {isCurrentChatFriend && !isCurrentChatBlocked && <button onClick={() => handleChatAction('removeFriend')} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center"><UserX size={16} className="mr-2.5"/> Remove Friend</button>}
                    {!isCurrentChatBlocked && <button onClick={() => handleChatAction('blockUser')} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center"><CircleSlash size={16} className="mr-2.5"/> Block User</button>}
                    {isCurrentChatBlocked && <button onClick={() => handleChatAction('unblockUser')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 flex items-center"><CircleSlash size={16} className="mr-2.5"/> Unblock User</button>}
                </div>
            )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">{messages.map(msg => (<ChatMessageItem key={msg.id} message={msg} currentUserId={user.uid} />))}<div ref={messagesEndRef} /></div>
      <div className="bg-white p-4 border-t border-slate-200 sticky bottom-0 z-20 mt-auto">
        <div className="relative"> 
          {showEmojiPicker && <EmojiPicker onEmojiSelect={handleEmojiSelect} onOutsideClick={() => setShowEmojiPicker(false)} />}
          <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
            <button id="emoji-toggle-button" type="button" onClick={() => setShowEmojiPicker(prev => !prev)} className="p-2.5 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-50 transition-colors"><Smile size={22} /></button>
            <button type="button" onClick={handleGifPlaceholderClick} className="p-2.5 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-50 transition-colors" title="Send a GIF (coming soon)"><Gift size={22} /></button>
            <div className="flex-1 relative">
              <textarea ref={inputRef} value={newMessage} onChange={(e) => { if (e.target.value.length <= 2000) setNewMessage(e.target.value);}} placeholder={isCurrentChatBlocked ? "This user is blocked." : "Type a message here..."} className="w-full p-3 pr-20 h-12 bg-slate-100 border-transparent focus:border-purple-500 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm transition-shadow text-slate-800 placeholder-slate-500 resize-none scrollbar-thin" rows="1" maxLength={2000} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e);}}} disabled={isSending || isCurrentChatBlocked} />
              <span className={`absolute bottom-2 right-3 text-xs ${newMessage.length > 1800 ? (newMessage.length > 2000 ? 'text-red-500 font-semibold' : 'text-orange-500') : 'text-slate-400'}`}>{newMessage.length}/2000</span>
            </div>
            <button type="button" className="p-2.5 text-slate-500 hover:text-purple-600 rounded-full hover:bg-purple-50 transition-colors" title="Attach file (coming soon)" disabled><Paperclip size={22} /></button>
            <button type="submit" disabled={isSending || !newMessage.trim() || newMessage.length > 2000 || isCurrentChatBlocked} className="bg-purple-600 text-white p-3 rounded-xl hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center w-12 h-12 transition-colors shadow-md hover:shadow-lg transform active:scale-95">{isSending ? <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <Send size={20} />}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

const ChatLayout = () => { const { currentChat, isMobileView } = useAppContext(); return ( <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden bg-slate-200 items-center justify-center p-0 md:p-4 lg:p-8"> <div className="flex h-full w-full max-w-screen-xl md:rounded-xl shadow-2xl overflow-hidden bg-white"> <div className={`md:flex flex-col ${isMobileView && currentChat ? 'hidden' : 'flex'}`}><ChatSidebar /></div> <div className={`flex-1 flex-col ${isMobileView && !currentChat ? 'hidden' : 'flex'}`}><ChatWindow /></div> </div> </div> );};

const AdminPortalPanel = () => {
  const { displaySystemNotification, setModalView, setModalData } = useAppContext();
  const [allUsersList, setAllUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    setLoadingUsers(true);
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("displayName"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllUsersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingUsers(false);
    }, (error) => {
      console.error("Error fetching all users for admin portal:", error);
      displaySystemNotification("Failed to load users for admin portal.", "error");
      setLoadingUsers(false);
    });
    return () => unsubscribe();
  }, [displaySystemNotification]);

  const handleViewUserProfile = (targetUser) => {
    setModalData(targetUser);
    setModalView('viewProfile');
  };

  if (loadingUsers) {
    return <div className="p-4 text-center text-slate-500">Loading users...</div>;
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold text-slate-800 mb-6">Admin Portal - User Management</h2>
      <div className="bg-white p-6 rounded-lg shadow-md max-w-3xl">
        {allUsersList.length === 0 ? (
          <p className="text-slate-500">No users found.</p>
        ) : (
          <ul className="space-y-3">
            {allUsersList.map(u => (
              <li key={u.uid} className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors">
                <div className="flex items-center space-x-3">
                  <img src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName || 'U')}&size=32&rounded=true`} alt={u.displayName} className="w-8 h-8 rounded-full"/>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{u.displayName} <span className="text-xs text-slate-500">#{u.discriminator}</span></p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </div>
                </div>
                <button 
                  onClick={() => handleViewUserProfile(u)}
                  className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-md transition-colors"
                >
                  Manage Badges
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};


const SettingsPage = () => { 
  const { user, setUser: setAppContextUser, displaySystemNotification, setView, theme, setTheme, soundEnabled, setSoundEnabled, hasInteracted, setHasInteracted, requestNotificationPerm, notificationPermission } = useAppContext(); 
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile'); 
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');
  const [newPhotoURL, setNewPhotoURL] = useState(user?.photoURL || '');
  const [newBio, setNewBio] = useState(user?.bio || '');
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  useEffect(() => { if (user) { setNewDisplayName(user.displayName || ''); setNewPhotoURL(user.photoURL || ''); setNewBio(user.bio || ''); }}, [user]);

  const handleProfileSave = useCallback(async () => {
    if (!user || !newDisplayName.trim()) { displaySystemNotification("Display name cannot be empty."); return; }
    if (newBio.length > 200) { displaySystemNotification("Bio cannot exceed 200 characters."); return; }
    setIsProfileSaving(true);
    try {
      const finalPhotoURL = newPhotoURL.trim() || `https://ui-avatars.com/api/?name=${encodeURIComponent(newDisplayName.trim())}&background=8B5CF6&color=FFFFFF&bold=true&rounded=true&size=128`;
      await updateAuthProfile(auth.currentUser, { displayName: newDisplayName.trim(), photoURL: finalPhotoURL }); 
      const userDocRef = doc(db, "users", user.uid);
      const updatedFields = { displayName: newDisplayName.trim(), photoURL: finalPhotoURL, bio: newBio.trim() };
      await updateDoc(userDocRef, updatedFields);
      setAppContextUser(prevUser => ({ ...prevUser, ...updatedFields })); 
      displaySystemNotification("Profile updated successfully!", 'success');
    } catch (error) { console.error("Error updating profile:", error); displaySystemNotification(`Failed to update profile: ${error.message}`); } 
    finally { setIsProfileSaving(false); }
  }, [user, newDisplayName, newPhotoURL, newBio, displaySystemNotification, setAppContextUser]);

  const handleChangePassword = useCallback(async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmNewPassword) { displaySystemNotification("New passwords do not match or are empty."); return; }
    if (newPassword.length < 6) { displaySystemNotification("New password must be at least 6 characters long."); return; }
    setIsPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      displaySystemNotification("Password updated successfully!", 'success');
      setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('');
    } catch (error) {
      console.error("Error changing password:", error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') { displaySystemNotification("Incorrect current password."); } 
      else { displaySystemNotification(`Failed to change password: ${error.message}`); }
    } finally { setIsPasswordSaving(false); }
  }, [currentPassword, newPassword, confirmNewPassword, displaySystemNotification]);

  const handleDeleteAccount = useCallback(async () => {
    const confirmEmail = window.prompt(`DANGER ZONE!\nThis action is irreversible and will delete all your data associated with ${APP_NAMESPACE_ID}.\nTo confirm, please type your email address: ${user?.email}`);
    if (confirmEmail !== user?.email) { displaySystemNotification("Email confirmation failed. Account not deleted.", 'info'); return; }
    const currentPass = window.prompt("For security, please re-enter your password:");
    if (!currentPass) { displaySystemNotification("Password not provided. Account deletion cancelled.", 'info'); return; }
    displaySystemNotification("Deleting account... Please wait.", 'info', 10000);
    try {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
        await reauthenticateWithCredential(auth.currentUser, credential);
        const batch = writeBatch(db);
        batch.delete(doc(db, "users", user.uid));
        await batch.commit();
        await deleteFirebaseAuthUser(auth.currentUser); 
        displaySystemNotification("Account deleted successfully. You have been signed out.", 'success');
    } catch (error) {
        console.error("Error deleting account:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') { displaySystemNotification("Incorrect password. Account deletion failed."); } 
        else if (error.code === 'auth/requires-recent-login') { displaySystemNotification("This operation is sensitive and requires recent authentication. Please sign out and sign back in, then try again."); } 
        else { displaySystemNotification(`Failed to delete account: ${error.message}`); }
    }
  }, [user, displaySystemNotification]);

  const handleSoundToggle = () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    localStorage.setItem(`${APP_NAMESPACE_ID}-soundEnabled`, newSoundEnabled.toString()); 
    if (newSoundEnabled && !hasInteracted) { setHasInteracted(true); }
    displaySystemNotification(`Sounds ${newSoundEnabled ? 'enabled' : 'disabled'}.`, 'info', 2000);
  };

  const baseSettingsTabs = [ 
    { name: 'Profile', id: 'profile', icon: User }, 
    { name: 'Account', id: 'account', icon: ShieldCheck }, 
    { name: 'Appearance', id: 'appearance', icon: Palette }, 
    { name: 'Notifications', id: 'notifications', icon: Bell },
  ];
  const settingsTabs = user?.isAdmin ? [...baseSettingsTabs, { name: 'Admin Portal', id: 'admin_portal', icon: SlidersHorizontal }] : baseSettingsTabs;

  return ( <div className="h-screen w-screen flex flex-col bg-slate-100"> <header className="bg-white shadow-sm p-4 flex items-center space-x-3 sticky top-0 z-30"> <button onClick={() => setView('chat')} className="p-2 text-slate-600 hover:bg-slate-200 rounded-full"><ArrowLeft size={22} /></button> <h1 className="text-xl font-semibold text-slate-800">Settings</h1> </header> <div className="flex-1 flex flex-col md:flex-row overflow-hidden"> <nav className="w-full md:w-64 bg-white border-r border-slate-200 p-4 space-y-1 md:overflow-y-auto scrollbar-thin"> {settingsTabs.map(tab => ( <button key={tab.id} onClick={() => setActiveSettingsTab(tab.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeSettingsTab === tab.id ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}> <tab.icon size={20} /><span>{tab.name}</span> </button> ))} </nav> <main className="flex-1 p-6 sm:p-8 overflow-y-auto scrollbar-thin bg-slate-50"> {activeSettingsTab === 'profile' && ( <section><h2 className="text-2xl font-semibold text-slate-800 mb-6">Edit Profile</h2><div className="bg-white p-6 rounded-lg shadow-md space-y-5 max-w-2xl"> <div className="flex flex-col items-center"><img src={newPhotoURL || user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(newDisplayName || user?.displayName || 'U')}&background=D1D5DB&color=4B5563&bold=true&size=128&rounded=true`} alt="Profile" className="w-32 h-32 rounded-full object-cover mb-3 shadow-md border-4 border-purple-200"/><p className="text-sm text-slate-500">Update your photo by providing a URL below.</p></div> <div><label htmlFor="settingsDisplayName" className="block text-sm font-medium text-slate-700 mb-1">Display Name</label><input id="settingsDisplayName" type="text" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-slate-400" placeholder="Enter your display name"/></div> <div><label htmlFor="settingsPhotoURL" className="block text-sm font-medium text-slate-700 mb-1">Photo URL</label><input id="settingsPhotoURL" type="text" value={newPhotoURL} onChange={(e) => setNewPhotoURL(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-slate-400" placeholder="https://example.com/avatar.jpg"/></div> <div><label htmlFor="settingsBio" className="block text-sm font-medium text-slate-700 mb-1">Bio (max 200 chars)</label><textarea id="settingsBio" value={newBio} onChange={(e) => setNewBio(e.target.value)} maxLength="200" rows="3" className="w-full px-4 py-3 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 placeholder-slate-400 resize-none scrollbar-thin" placeholder="Tell us a little about yourself..."/></div> <div className="pt-3 flex justify-end"><button onClick={handleProfileSave} disabled={isProfileSaving || !newDisplayName.trim()} className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 flex items-center transition-colors">{isProfileSaving ? <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <Save size={16} className="mr-1.5"/>} Save Profile</button></div> </div></section> )} {activeSettingsTab === 'account' && ( <section><h2 className="text-2xl font-semibold text-slate-800 mb-6">Account Settings</h2><div className="bg-white p-6 rounded-lg shadow-md space-y-6 max-w-2xl"> <div><h3 className="text-lg font-medium text-slate-700 mb-1">Email Address</h3><p className="text-sm text-slate-500 bg-slate-100 p-3 rounded-md">{user?.email}</p></div> <div><h3 className="text-lg font-medium text-slate-700 mb-1">Your User Tag</h3><p className="text-sm text-slate-500 bg-slate-100 p-3 rounded-md">{user?.displayName || ''}#{user?.discriminator || '0000'}</p></div> <form onSubmit={handleChangePassword} className="space-y-4 pt-4 border-t border-slate-200"> <h3 className="text-lg font-medium text-slate-700">Change Password</h3> <div><label htmlFor="currentPassword"className="block text-sm font-medium text-slate-700 mb-1">Current Password</label><input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400" placeholder="••••••••"/></div> <div><label htmlFor="newPassword"className="block text-sm font-medium text-slate-700 mb-1">New Password</label><input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400" placeholder="New password (min. 6 characters)"/></div> <div><label htmlFor="confirmNewPassword"className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label><input id="confirmNewPassword" type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400" placeholder="Confirm new password"/></div> <div className="flex justify-end"><button type="submit" disabled={isPasswordSaving} className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60 flex items-center transition-colors">{isPasswordSaving ? <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75" fill="currentColor"></path></svg> : <ShieldCheck size={16} className="mr-1.5"/>} Update Password</button></div> </form> <div className="pt-6 border-t border-slate-200"><h3 className="text-lg font-medium text-red-600 mb-2">Danger Zone</h3><button onClick={handleDeleteAccount} className="w-full sm:w-auto px-6 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center transition-colors"><Trash2 size={16} className="mr-1.5"/> Delete My Account</button><p className="text-xs text-slate-500 mt-2">This action is irreversible and will delete your user profile and related data.</p></div> </div></section> )} {activeSettingsTab === 'appearance' && ( <section><h2 className="text-2xl font-semibold text-slate-800 mb-6">Appearance</h2><div className="bg-white p-6 rounded-lg shadow-md space-y-5 max-w-2xl"> <h3 className="text-lg font-medium text-slate-700 mb-1">Theme</h3> <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {[{ id: 'default', name: 'Default Light', icon: Sun, bg: 'bg-slate-100' }, { id: 'dark', name: 'Default Dark', icon: Moon, bg: 'bg-slate-800' }].map(t => ( <button key={t.id} onClick={() => setTheme(t.id)} className={`p-4 rounded-lg border-2 transition-all duration-150 focus:outline-none ${theme === t.id ? 'border-purple-500 ring-2 ring-purple-500 shadow-lg' : 'border-slate-300 hover:border-purple-400 hover:shadow-md'}`}> <div className={`w-full h-16 rounded mb-2 mx-auto ${t.bg} border border-slate-300`}></div> <div className="flex items-center justify-center"><t.icon size={18} className={`mr-2 ${theme === t.id ? 'text-purple-600' : 'text-slate-500'}`} /><span className={`text-sm font-medium ${theme === t.id ? 'text-purple-700' : 'text-slate-600'}`}>{t.name}</span></div> </button> ))} </div> </div></section> )} {activeSettingsTab === 'notifications' && ( <section><h2 className="text-2xl font-semibold text-slate-800 mb-6">Notification Settings</h2><div className="bg-white p-6 rounded-lg shadow-md space-y-5 max-w-2xl"> <div className="pt-0"> <h3 className="text-lg font-medium text-slate-700 mb-2">Browser Notifications</h3> {notificationPermission === 'default' && <button onClick={requestNotificationPerm} className="px-5 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center transition-colors"><Bell size={16} className="mr-1.5"/> Enable Browser Notifications</button>} {notificationPermission === 'granted' && <p className="text-sm text-green-600 flex items-center"><CheckCircle size={18} className="mr-2"/> Browser notifications are enabled.</p>} {notificationPermission === 'denied' && <p className="text-sm text-red-600 flex items-center"><XCircle size={18} className="mr-2"/> Browser notifications are disabled. You can change this in your browser's site settings.</p>} </div> <div className="mt-6 pt-4 border-t border-slate-200"> <h3 className="text-lg font-medium text-slate-700 mb-2">Sound Effects</h3> <label htmlFor="soundToggle" className="flex items-center cursor-pointer p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"> <div className="relative"> <input type="checkbox" id="soundToggle" className="sr-only" checked={soundEnabled} onChange={handleSoundToggle} /> <div className={`block w-10 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-purple-600' : 'bg-slate-300'}`}></div> <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${soundEnabled ? 'translate-x-full' : ''}`}></div> </div> <span className="ml-3 text-sm font-medium text-slate-700">Enable In-App Sounds</span> {soundEnabled ? <Volume2 size={18} className="ml-auto text-purple-600"/> : <VolumeX size={18} className="ml-auto text-slate-500"/>} </label> </div> </div></section> )} {activeSettingsTab === 'admin_portal' && user?.isAdmin && <AdminPortalPanel />} </main> </div> </div> );
};

const NotificationItem = React.memo(({ notification, onMarkAsRead, onView }) => {
  const IconComponent = { new_message: MessageSquareText, friend_request_received: UserPlus, friend_request_accepted: UserCheck, default: Bell }[notification.type] || Bell;
  const handleView = (e) => { e.stopPropagation(); if (onView) onView(notification); };
  const handleMarkRead = (e) => { e.stopPropagation(); if (onMarkAsRead) onMarkAsRead(notification.id); };
  return (
    <div className={`p-4 mb-3 rounded-lg transition-all duration-150 cursor-pointer flex items-start space-x-3 ${notification.isRead ? 'bg-slate-50 hover:bg-slate-100' : 'bg-purple-50 hover:bg-purple-100 shadow-sm'}`} onClick={handleView}>
      <div className={`p-2 rounded-full ${notification.isRead ? 'bg-slate-200 text-slate-500' : 'bg-purple-100 text-purple-600'}`}><IconComponent size={20} /></div>
      <div className="flex-1">
        <div className="flex justify-between items-start">
          <p className={`text-sm ${notification.isRead ? 'text-slate-700' : 'text-slate-800 font-medium'}`}>{notification.actorName && <span className="font-semibold">{notification.actorName}</span>} {notification.message}</p>
          {!notification.isRead && ( <button onClick={handleMarkRead} title="Mark as read" className="ml-2 p-1 text-xs text-purple-500 hover:text-purple-700 hover:bg-purple-200 rounded-full"><CheckCircle size={16}/></button>)}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{notification.timestamp?.toDate ? new Date(notification.timestamp.toDate()).toLocaleString() : 'Just now'}</p>
      </div>
    </div>
  );
});

const NotificationsPanel = () => { 
  const { user, isNotificationsPanelOpen, setIsNotificationsPanelOpen, appNotifications, displaySystemNotification, setCurrentChat, setView, setModalView, setModalData, setActiveTabInSidebar } = useAppContext(); // Assuming setActiveTabInSidebar is passed

  const handleMarkAsRead = async (notificationId) => {
    if (!user) return;
    try { const notifRef = doc(db, `users/${user.uid}/user_notifications`, notificationId); await updateDoc(notifRef, { isRead: true }); } 
    catch (error) { console.error("Error marking notification as read:", error); displaySystemNotification("Failed to update notification.", "error"); }
  };

  const handleMarkAllAsRead = async () => {
    if (!user || appNotifications.filter(n => !n.isRead).length === 0) return;
    const batch = writeBatch(db);
    appNotifications.forEach(n => { if (!n.isRead) { const notifRef = doc(db, `users/${user.uid}/user_notifications`, n.id); batch.update(notifRef, { isRead: true }); }});
    try { await batch.commit(); displaySystemNotification("All notifications marked as read.", "success", 2000); } 
    catch (error) { console.error("Error marking all notifications as read:", error); displaySystemNotification("Failed to mark all as read.", "error"); }
  };

  const handleViewNotification = (notification) => {
    if (notification.link) {
        if (notification.link.startsWith('/chat/')) {
            const chatPartnerId = notification.link.split('/chat/')[1];
            const partnerDocRef = doc(db, "users", chatPartnerId);
            getDoc(partnerDocRef).then(docSnap => {
                if (docSnap.exists()) {
                    const partnerData = docSnap.data();
                     setCurrentChat({ id: partnerData.uid, type: 'dm', name: `${partnerData.displayName || partnerData.email.split('@')[0]}#${partnerData.discriminator || '0000'}`, rawName: partnerData.displayName || partnerData.email.split('@')[0], discriminator: partnerData.discriminator || '0000', photoURL: partnerData.photoURL });
                    setView('chat');
                } else { displaySystemNotification("Could not find user for this chat.", "error"); }
            }).catch(err => displaySystemNotification("Error opening chat.", "error"));
        } else if (notification.link.startsWith('/profile/')) {
            const profileUserId = notification.link.split('/profile/')[1];
            const profileUserDocRef = doc(db, "users", profileUserId);
            getDoc(profileUserDocRef).then(docSnap => {
                if (docSnap.exists()) { setModalData(docSnap.data()); setModalView('viewProfile'); } 
                else { displaySystemNotification("Could not find user profile.", "error"); }
            }).catch(err => displaySystemNotification("Error opening profile.", "error"));
        } else if (notification.link === '/friends') { 
            setView('chat'); 
            displaySystemNotification("Check your Friends tab for requests.", "info");
        }
    }
    if (!notification.isRead) handleMarkAsRead(notification.id);
    setIsNotificationsPanelOpen(false);
  };
  
  if (!isNotificationsPanelOpen) return null; 
  const unreadNotifications = appNotifications.filter(n => !n.isRead);
  const readNotifications = appNotifications.filter(n => n.isRead);

  return ( 
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modal-appear"> 
      <div className="bg-white p-0 rounded-xl shadow-2xl w-full max-w-lg transform transition-all flex flex-col max-h-[85vh] sm:max-h-[70vh]"> 
        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-200">
          <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 flex items-center"><Bell size={22} className="mr-2.5 text-purple-600"/>Notifications</h2>
          <div className="flex items-center space-x-2">
            {unreadNotifications.length > 0 && ( <button onClick={handleMarkAllAsRead} className="text-xs sm:text-sm text-purple-600 hover:text-purple-800 font-medium px-2 py-1 rounded-md hover:bg-purple-100 transition-colors" title="Mark all as read">Mark All Read</button> )}
            <button onClick={() => setIsNotificationsPanelOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"><X size={22} /></button>
          </div>
        </div> 
        <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 flex-grow p-4 sm:p-5"> 
          {appNotifications.length === 0 ? ( <div className="flex flex-col items-center justify-center h-full text-slate-500 py-10 text-center"> <Bell size={40} className="opacity-50 mb-4"/> <p className="text-md sm:text-lg">No notifications yet.</p> <p className="text-xs sm:text-sm">We'll let you know when something new comes up!</p> </div> ) : (
            <>
              {unreadNotifications.length > 0 && ( <div className="mb-4"> <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">New</h3> {unreadNotifications.map(n => <NotificationItem key={n.id} notification={n} onMarkAsRead={handleMarkAsRead} onView={handleViewNotification} />)} </div> )}
              {readNotifications.length > 0 && ( <div className="mb-1"> <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Earlier</h3> {readNotifications.map(n => <NotificationItem key={n.id} notification={n} onMarkAsRead={handleMarkAsRead} onView={handleViewNotification}/>)} </div> )}
            </>
          )}
        </div> 
      </div> 
    </div> 
  );
};

const AdminBadgeManager = ({ targetUserId, currentBadges = [] }) => {
  const { assignBadgesToUser, displaySystemNotification } = useAppContext();
  const [selectedBadges, setSelectedBadges] = useState(new Set(currentBadges.filter(b => ASSIGNABLE_BADGES.includes(b))));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedBadges(new Set(currentBadges.filter(b => ASSIGNABLE_BADGES.includes(b))));
  }, [currentBadges]);

  const handleBadgeToggle = (badgeId) => {
    setSelectedBadges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(badgeId)) {
        newSet.delete(badgeId);
      } else {
        newSet.add(badgeId);
      }
      return newSet;
    });
  };

  const handleSaveBadges = async () => {
    setIsSaving(true);
    // Preserve non-assignable badges (like 'Admin') if they exist from direct DB edit
    const existingAdminBadge = currentBadges.includes('Admin') ? ['Admin'] : [];
    const finalBadges = [...new Set([...existingAdminBadge, ...Array.from(selectedBadges)])]; // Ensure Admin is preserved and no duplicates

    const success = await assignBadgesToUser(targetUserId, finalBadges);
    if (success) {
      // displaySystemNotification("Badges updated successfully!", "success"); // Already shown by assignBadgesToUser
    }
    setIsSaving(false);
  };

  return (
    <div className="mt-6 pt-4 border-t border-slate-200 w-full">
      <h3 className="text-md font-semibold text-slate-700 mb-3 flex items-center"><Award size={18} className="mr-2 text-purple-600"/> Manage User Badges</h3>
      <div className="space-y-2 mb-4">
        {ASSIGNABLE_BADGES.map(badgeId => {
          const badgeInfo = BADGE_DEFINITIONS[badgeId];
          if (!badgeInfo) return null;
          return (
            <label key={badgeId} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={selectedBadges.has(badgeId)}
                onChange={() => handleBadgeToggle(badgeId)}
                className="form-checkbox h-5 w-5 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
              />
              <img src={badgeInfo.imageSrc} alt={badgeInfo.name} className="w-6 h-6" onError={(e) => e.target.style.display='none'}/>
              <span className="text-sm text-slate-700">{badgeInfo.name}</span>
            </label>
          );
        })}
      </div>
      <button 
        onClick={handleSaveBadges} 
        disabled={isSaving}
        className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-60"
      >
        {isSaving ? <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <Save size={16} className="mr-2"/>}
        Save Badges
      </button>
    </div>
  );
};


const UserProfileModal = () => {
  const { modalView, setModalView, modalData, setModalData, user, friends, friendRequests, handleUserAction, displaySystemNotification, setCurrentChat, setView } = useAppContext(); 

  if (modalView !== 'viewProfile' || !modalData) return null;

  const targetUser = modalData; 
  const viewingUser = user; 

  const isSelf = viewingUser?.uid === targetUser.uid;
  const isAlreadyFriend = friends.some(f => f.friendUid === targetUser.uid);
  const hasIncomingRequestFromTarget = friendRequests.incoming.some(req => req.fromUid === targetUser.uid);
  const hasSentRequestToTarget = friendRequests.outgoing.some(req => req.toUid === targetUser.uid);
  
  const onMessageUser = () => {
    setCurrentChat({
        id: targetUser.uid, type: 'dm',
        name: `${targetUser.displayName || targetUser.email?.split('@')[0]}#${targetUser.discriminator || '0000'}`,
        rawName: targetUser.displayName || targetUser.email?.split('@')[0], 
        discriminator: targetUser.discriminator || '0000', 
        photoURL: targetUser.photoURL
    });
    setView('chat');
    setModalView(null); 
    setModalData(null);
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-modal-appear">
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all flex flex-col items-center">
        <button onClick={() => { setModalView(null); setModalData(null); }} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100"><X size={22} /></button>
        <img src={targetUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetUser.displayName || 'U')}&background=8B5CF6&color=FFFFFF&bold=true&rounded=true&size=128`} alt={targetUser.displayName} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover mb-4 shadow-lg border-4 border-purple-300"/>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">{targetUser.displayName || 'User'}</h2>
        <p className="text-slate-500 text-sm">#{targetUser.discriminator || '0000'}</p>
        
        {targetUser.badges && targetUser.badges.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 my-3">
            {targetUser.badges.map(badgeId => {
              const badgeInfo = BADGE_DEFINITIONS[badgeId];
              if (!badgeInfo) return null;
              return (
                <img 
                  key={badgeId} 
                  src={badgeInfo.imageSrc} 
                  alt={badgeInfo.name} 
                  title={`${badgeInfo.name}: ${badgeInfo.description}`} 
                  className="w-8 h-8 sm:w-10 sm:h-10"
                  onError={(e) => { e.target.style.display = 'none'; /* Hide if image fails */ }}
                />
              );
            })}
          </div>
        )}

        {targetUser.bio && (<p className="text-sm text-slate-600 my-3 text-center max-w-xs italic">"{targetUser.bio}"</p>)}
        <p className="text-sm text-slate-600 my-2">Status: <span className="font-medium text-green-500">{targetUser.status || 'Online'}</span></p>

        {!isSelf && (
          <div className="mt-6 w-full space-y-3">
            <button onClick={onMessageUser} className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
              <MessageSquareText size={18} className="mr-2"/> Message {targetUser.displayName?.split(' ')[0]}
            </button>
            {!isAlreadyFriend && !hasIncomingRequestFromTarget && !hasSentRequestToTarget && (
              <button onClick={() => { if(handleUserAction) handleUserAction('addFriend', targetUser); setModalView(null); setModalData(null); }} className="w-full flex items-center justify-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                <UserPlus2 size={18} className="mr-2"/> Add Friend
              </button>
            )}
            {hasIncomingRequestFromTarget && (
                 <button onClick={() => { if(handleUserAction) handleUserAction('acceptFriend', targetUser); setModalView(null); setModalData(null); }} className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                    <UserCheck size={18} className="mr-2"/> Accept Friend Request
                </button>
            )}
            {hasSentRequestToTarget && (
                 <button disabled className="w-full flex items-center justify-center py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-400 bg-slate-100 cursor-not-allowed">
                    <UserCheck size={18} className="mr-2 opacity-50"/> Friend Request Sent
                </button>
            )}
          </div>
        )}
        {viewingUser?.isAdmin && !isSelf && (
          <AdminBadgeManager targetUserId={targetUser.uid} currentBadges={targetUser.badges} />
        )}
         <button onClick={() => { setModalView(null); setModalData(null); }} className="mt-6 text-sm text-purple-600 hover:underline">Close</button>
      </div>
    </div>
  );
};


function App() { return ( <AppProvider> <MainContent /> </AppProvider> ); }

const GlobalErrorDisplay = ({ error, clearError }) => { useEffect(() => { if (error) { const t = setTimeout(() => { clearError(); }, 7000); return () => clearTimeout(t); }}, [error, clearError]); if (!error) return null; const isSuccess = error.type === 'success'; const isInfo = error.type === 'info'; let bgColor = 'bg-red-600'; if (isSuccess) bgColor = 'bg-green-500'; else if (isInfo) bgColor = 'bg-blue-500'; return (<div className={`fixed top-6 right-6 ${bgColor} text-white p-4 rounded-lg shadow-xl z-[200] flex items-center animate-slide-in-right max-w-sm sm:max-w-md`}><AlertTriangle size={22} className={`mr-2.5 flex-shrink-0 ${isSuccess || isInfo ? 'hidden' : ''}`}/> <CheckCircle size={22} className={`mr-2.5 flex-shrink-0 ${!isSuccess ? 'hidden' : ''}`}/> <BadgeHelp size={22} className={`mr-2.5 flex-shrink-0 ${!isInfo ? 'hidden' : ''}`}/> <span className="text-sm break-words">{error.message}</span></div>);};

const MainContent = () => { 
  const { loading, systemNotification, displaySystemNotification, view, user, modalView } = useAppContext(); 
  if (loading && !user) { return (<div className="min-h-screen flex items-center justify-center bg-slate-100"><svg className="animate-spin h-12 w-12 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>); }
  let currentViewComponent;
  switch (view) {
    case 'login': currentViewComponent = <AuthForm />; break;
    case 'chat': currentViewComponent = <ChatLayout />; break;
    case 'settings': currentViewComponent = <SettingsPage />; break;
    default: currentViewComponent = loading ? <div></div> : <AuthForm />; 
  }
  return (
    <div className={`app-shell font-sans theme-default`}>
      {systemNotification && <GlobalErrorDisplay error={systemNotification} clearError={() => displaySystemNotification(null, '', 'clear')} />}
      {currentViewComponent}
      <NotificationsPanel /> 
      {modalView === 'viewProfile' && <UserProfileModal />}
    </div>
  );
};

export default App;