'use client';

import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { AppUser } from '@/lib/db';
import { MessageCircle, X, Send } from 'lucide-react';
import styles from './GroupChatBubble.module.css';

interface Message {
  id: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: any;
}

export default function GroupChatBubble({ 
  groupId, 
  currentUser 
}: { 
  groupId: string;
  currentUser: { id: string, name?: string | null } | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupId) return;

    const q = query(collection(db, 'groups', groupId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      
      setMessages(prev => {
        if (!isOpen && fetchedMessages.length > prev.length && prev.length > 0) {
          setUnreadCount(count => count + (fetchedMessages.length - prev.length));
        }
        return fetchedMessages;
      });
    });

    return () => unsubscribe();
  }, [groupId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !groupId) return;

    const text = newMessage;
    setNewMessage('');
    await addDoc(collection(db, 'groups', groupId, 'messages'), {
      groupId,
      userId: currentUser.id,
      userName: currentUser.name || 'User',
      message: text,
      createdAt: serverTimestamp(),
    });
  };

  return (
    <div className={styles.chatContainer}>
      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageCircle size={18} />
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Chat Kelompok</h3>
            </div>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>
          
          <div className={styles.messagesArea}>
            {messages.map((msg) => {
              const isMe = msg.userId === currentUser?.id;
              return (
                <div key={msg.id} className={`${styles.messageWrapper} ${isMe ? styles.messageWrapperMe : ''}`}>
                  {!isMe && <span className={styles.messageAuthor}>{msg.userName}</span>}
                  <div className={`${styles.messageBubble} ${isMe ? styles.messageBubbleMe : ''}`}>
                    {msg.message}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className={styles.inputArea}>
            <input 
              type="text" 
              className={styles.chatInput}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Tulis pesan..."
            />
            <button type="submit" className={styles.sendBtn} disabled={!newMessage.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      <button className={styles.toggleBtn} onClick={() => setIsOpen(!isOpen)}>
        <MessageCircle size={24} />
        {unreadCount > 0 && !isOpen && (
          <span className={styles.unreadBadge}>{unreadCount}</span>
        )}
      </button>
    </div>
  );
}
