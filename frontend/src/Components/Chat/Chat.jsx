import React, { useEffect, useRef, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { ChatBoxReciever, ChatBoxSender } from './ChatBox';
import InputText from './InputText';
import './Chat.css';
import pic from '../../Assets/avatar.png';
import { useUser } from '../../Context/UserContext';
import List from '../../Components/List/List';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { GLOBAL_CONFIG } from '../../Constants/Config';

export const Chat = () => {
    const {roomId} = useParams(); // Get roomId from the route
    const { user } = useUser();
    const [chats, setChats] = useState([]);
    const [avatar] = useState(localStorage.getItem('avatar'));
    const endRef = useRef(null);
    const stompClientRef = useRef(null);
    const [messagesByRoom, setMessagesByRoom] = useState({});
    const { state } = useLocation();
    const [chatter, setChatter] = useState(state?.chatterUsername || "Unknown User");

    // Scroll to the bottom of the chat
    const scrollToBottom = () => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    const fetchPreviousMessages = async () => {
        try {
            const response = await fetch(`${GLOBAL_CONFIG.backendUrl}/messages/room/${roomId}`, {
                headers: {
                    Authorization: `Bearer ${user?.accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch messages.");
            }

            const data = await response.json();
            setMessagesByRoom((prevMessages) => ({
                ...prevMessages,
                [roomId]: data.map((msg) => ({
                    username: msg.userId, // Assuming messages include userId
                    message: msg.text, // Assuming messages include text
                })),
            }));
            setChats(data.map((msg) => ({
                username: msg.userId,
                message: msg.text,
            })));
        } catch (error) {
            console.error("Error fetching messages:", error);
        }
    };
    useEffect(() => {
        fetchPreviousMessages();
    }, [roomId]);
    // Log user information
    useEffect(() => {
        if (!user) {
            console.warn('User is not logged in');
        } else {
            console.info(`Logged in as: ${user.username}`);
        }
    }, [user]);

    // Setup WebSocket connection
    useEffect(() => {
        const socketUrl = `${GLOBAL_CONFIG.backendUrl}/chat-websocket?token=${user?.accessToken}`;
        const socket = new SockJS(socketUrl);
        stompClientRef.current = Stomp.over(socket);

        stompClientRef.current.connect({}, () => {
            console.log('Connected to WebSocket');

            const subscription = stompClientRef.current.subscribe(`/topic/room/${roomId}`, (message) => {
                const messageBody = JSON.parse(message.body);
                console.log('Received WebSocket message:', messageBody);

                // Adjust for the correct message format (id, text, userId)
                if (!messageBody.userId || !messageBody.text) {
                    console.error('Invalid message format:', messageBody);
                }
                // Map the incoming data to the correct format for ChatsList
                const mappedMessage = {
                    username: messageBody.userId, // Assuming you will map userId to username somehow
                    message: messageBody.text
                };
                setMessagesByRoom((prevMessages) => ({ //saves messages when clicking away from messages
                    ...prevMessages,
                    [roomId]: [...(prevMessages[roomId] || []), mappedMessage],
                }));
                setChats((prevChats) => {
                    // Avoid duplicates based on message content and sender
                    if (!prevChats.some((chat) => chat.message === mappedMessage.message && chat.username === mappedMessage.username)) {
                        return [...prevChats, mappedMessage];
                    }
                    return prevChats;
                });
            });

            return () => {
                subscription.unsubscribe();
                stompClientRef.current.disconnect();
                console.log('Disconnected from WebSocket');
            };
        });
    }, [roomId, user]);

    // Scroll to the bottom whenever chats update
    useEffect(() => {
        scrollToBottom();
    }, [chats]);

    // Send message to WebSocket
    const sendChatToSocket = (chat) => {
        const messageToSend = {
            roomId: roomId,
            senderUserId: user?.userId,
            message: chat.message,
        };
        console.log('Sending message:', messageToSend);

        if (stompClientRef.current && stompClientRef.current.connected) {
            stompClientRef.current.send(`/app/chat/${roomId}`, {}, JSON.stringify(messageToSend));
        } else {
            console.error('WebSocket is not connected');
        }
    };

    // Add message to chats and send to WebSocket
    const addMessage = (chat) => {
        const newChat = { ...chat, username: user?.username || '' };
        sendChatToSocket(newChat);
    };
    // Clear chats when roomId changes
    useEffect(() => {
        setChats(messagesByRoom[roomId] || []);
        setChatter(null); 
    }, [roomId, messagesByRoom]);
    
    // Render chat messages
    const ChatsList = () => {
        console.log('Rendering ChatsList');
        return chats.map((chat, index) => {
            const chatUsername = chat.username // Fallback to empty string if undefined
            const loggedInUsername = user.userId // Fallback to empty string if undefined
            console.log(`Chat message: "${chat.message}", Chat User: "${chatUsername}", Logged-in User: "${loggedInUsername}"`);

            const isSender = chatUsername ==loggedInUsername;
            console.log(`Is sender: ${isSender}`);

            if (isSender) {
                return <ChatBoxSender key={index} message={chat.message} avatar={pic} />;
            } else {
                return <ChatBoxReciever key={index} message={chat.message} avatar={pic} />;
            }
        });
    };
    useEffect(() => {
        // Keep chatter as-is unless the new room has a different chatterUsername
        if (messagesByRoom[roomId]) {
            setChats(messagesByRoom[roomId]);
        } else {
            setChats([]);
        }
    
        // Retain chatter from state or fallback to previous value
        if (state?.chatterUsername) {
            setChatter(state.chatterUsername);
        }
    }, [roomId, messagesByRoom, state]);
    return (
        <div className="container">
            <div className="layout">
                <List />
                <div className="chat">
                    <div className="top">
                        <div className="user">
                            <img src={pic} alt="User Avatar" />
                            <div className="texts">
                                <span className='chatter'>{chatter}</span>
                                <p>Online</p>
                            </div>
                        </div>
                    </div>
                    <div className="center">
                        <ChatsList />
                        <div ref={endRef}></div>
                    </div>
                    <div className="input">
                        <InputText addMessage={addMessage} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Chat;