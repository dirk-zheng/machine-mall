import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import wsClient from '../api/ws';
import FloatingSupport from './FloatingSupport';

const CLICKED_KEY = 'aurelia_beauty_support_clicked';

//渲染:渲染SupportWidget组件或页面内容
export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [showDot, setShowDot] = useState(false);
  const [unreadSenders, setUnreadSenders] = useState(new Set());
  const { user } = useAuth();
  const isOpenRef = useRef(false);

  isOpenRef.current = isOpen; // always current

  const isStaff = user?.role === 'admin' || ['seller', 'salesperson'].includes(user?.role);
  const isCustomer = !user || !isStaff;

  // Customer: check localStorage on mount / when user loads
  useEffect(() => {
              //执行组件副作用逻辑

    if (isCustomer) {
      setShowDot(localStorage.getItem(CLICKED_KEY) !== 'true');
    } else if (unreadSenders.size === 0) {
      setShowDot(false);
    }
  }, [isCustomer, user?.account]); // re-check when user changes

  // Sales: listen for incoming IM messages
  useEffect(() => {
              //执行组件副作用逻辑

    if (!isStaff) return;

    const unsubMessage = wsClient.on('support.message.created', (data) => {
      if (data.senderType !== 'customer') return;
                                              //处理回调函数逻辑

      if (!isOpenRef.current) {
        setShowDot(true);
        setUnreadSenders(prev => {
                           //处理回调函数逻辑

          const next = new Set(prev);
          next.add(data.visitorId || data.account || data.senderType);
          return next;
        });
      }
    });

    const unsubQueue = wsClient.on('support.conversation.updated', (data) => {
      if (data.status === 'waiting_human' && !isOpenRef.current) setShowDot(true);
    });

    return () => { unsubMessage(); unsubQueue(); };
  }, [isStaff]);

  const handleToggle = useCallback(() => {
                                     //创建并缓存回调函数

    const opening = !isOpen;
    setIsOpen(opening);

    if (opening) {
      // Clear dot for customer
      if (isCustomer) {
        localStorage.setItem(CLICKED_KEY, 'true');
      }
      setShowDot(false);
      setUnreadSenders(new Set());
    }
  }, [isOpen, isCustomer]);

  const handleClose = useCallback(() => {
                                    //创建并缓存回调函数

    setIsOpen(false);
    // Don't re-show the customer dot after close (already clicked)
    // Sales dot may re-appear on next incoming message
  }, []);

  const unreadCount = unreadSenders.size;

  if (isStaff) {
    return (
      <Link to="/support/inbox" className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-white shadow-lg shadow-primary/30 transition-transform hover:scale-110" title="Ingredient inquiry inbox" aria-label="Ingredient inquiry inbox">
        {showDot && <span className="absolute -right-1 -top-1 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full border-[3px] border-white bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount || ''}</span>}
        <MessageCircle size={30} />
      </Link>
    );
  }

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={handleToggle}
        className={`fixed bottom-6 right-6 h-[178px] w-[178px] rounded-full bg-gradient-to-br from-primary to-secondary shadow-2xl shadow-primary/30 flex items-center justify-center z-50 transition-all hover:scale-105 hover:shadow-2xl hover:shadow-primary/40 ${
          isOpen ? 'rotate-90' : ''
        }`}
        title={isStaff ? 'Ingredient Messages' : 'Aurelia Ingredient Support'}
        aria-label={isOpen ? 'Close ingredient support' : 'Open ingredient support'}
      >
        {/* Big Red Dot */}
        {showDot && (
          <span className="absolute right-0.5 top-0.5 flex h-10 min-w-10 items-center justify-center rounded-full border-[5px] border-white bg-red-500 shadow-xl animate-pulse">
            {isStaff && unreadCount > 0 ? (
              <span className="text-white text-[10px] font-bold leading-none px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </span>
        )}

        {isOpen ? (
          <svg className="h-[72px] w-[72px] text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <MessageCircle size={72} className="text-white" />
        )}
      </button>

      {/* Chat Panel */}
      <FloatingSupport isOpen={isOpen} onClose={handleClose} />
    </>
  );
}
