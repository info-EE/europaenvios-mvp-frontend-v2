import React, { createContext, useContext, useState, useCallback, Fragment } from 'react';
import { AlertModal } from '../components/common/AlertModal';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { PromptModal } from '../components/common/PromptModal';

const ModalContext = createContext();

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal debe ser usado dentro de un ModalProvider');
  }
  return context;
};

export const ModalProvider = ({ children }) => {
  const [modalState, setModalState] = useState(null); // 'alert', 'confirmation', 'prompt', or null
  const [modalProps, setModalProps] = useState({});

  const showAlert = useCallback((title, message) => {
    return new Promise((resolve) => {
      setModalProps({
        title,
        children: message,
        onClose: () => {
          setModalState(null);
          resolve(true);
        },
      });
      setModalState('alert');
    });
  }, []);

  const showConfirmation = useCallback((title, message) => {
    return new Promise((resolve) => {
      setModalProps({
        title,
        children: message,
        onConfirm: () => resolve(true),
        onClose: () => {
          setModalState(null);
          resolve(false);
        },
      });
      setModalState('confirmation');
    });
  }, []);
  
  const showPrompt = useCallback(({ title, message, inputLabel, initialValue }) => {
    return new Promise((resolve) => {
      setModalProps({
        title,
        message,
        inputLabel,
        initialValue,
        onConfirm: (value) => resolve(value),
        onClose: () => {
          setModalState(null);
          resolve(null); // Retorna null si se cancela, como window.prompt
        },
      });
      setModalState('prompt');
    });
  }, []);


  const value = { showAlert, showConfirmation, showPrompt };

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Fragment>
        <AlertModal
          open={modalState === 'alert'}
          {...modalProps}
        />
        <ConfirmationModal
          open={modalState === 'confirmation'}
          {...modalProps}
        />
        <PromptModal
          open={modalState === 'prompt'}
          {...modalProps}
        />
      </Fragment>
    </ModalContext.Provider>
  );
};