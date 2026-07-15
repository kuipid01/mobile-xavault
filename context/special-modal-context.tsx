import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { PaymentVerificationWatcher } from '../components/general/payment-verification-watcher';
import { GlobalModalContainer } from '../components/global-modal-container';

type OpenModalOptions = {
    onDismiss?: () => void | Promise<void>;
};

type CloseModalOptions = {
    skipDismissCallback?: boolean;
};

interface ModalContextType {
    isOpen: boolean;
    // Dynamic content can be any React component/element, or null
    modalContent: ReactNode | null;
    // Open function accepts the component you want to render
    openModal: (content: ReactNode, options?: OpenModalOptions) => void;
    closeModal: (options?: CloseModalOptions) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [modalContent, setModalContent] = useState<ReactNode | null>(null);
    const [onDismiss, setOnDismiss] = useState<OpenModalOptions["onDismiss"]>();

    const openModal = useCallback((content: ReactNode, options?: OpenModalOptions) => {
        setModalContent(content);
        setOnDismiss(() => options?.onDismiss);
        setIsOpen(true);
    }, []);

    const closeModal = useCallback((options?: CloseModalOptions) => {
        if (!options?.skipDismissCallback) {
            void onDismiss?.();
        }

        setIsOpen(false);
        setOnDismiss(undefined);
        // Optional delay to clear content after close animation finishes
        setTimeout(() => setModalContent(null), 200);
    }, [onDismiss]);

    const value = useMemo(
        () => ({ isOpen, modalContent, openModal, closeModal }),
        [closeModal, isOpen, modalContent, openModal]
    );

    return (
        <ModalContext.Provider value={value}>
            {children}

            <GlobalModalContainer />
            <PaymentVerificationWatcher />
        </ModalContext.Provider>
    );
}

export function useModal() {
    const context = useContext(ModalContext);
    if (!context) throw new Error('useModal must be used within a ModalProvider');
    return context;
}
