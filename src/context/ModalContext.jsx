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
  const [modalConfig, setModalConfig] = useState(null);

  const closeModal = () => setModalConfig(null);

  const showAlert = useCallback((title, message) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'alert',
        title,
        message,
        onClose: () => {
          closeModal();
          resolve(true);
        },
      });
    });
  }, []);

  const showConfirmation = useCallback((title, message) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'confirmation',
        title,
        message,
        onConfirm: () => {
          closeModal();
          resolve(true);
        },
        onClose: () => {
          closeModal();
          resolve(false);
        },
      });
    });
  }, []);
  
  const showPrompt = useCallback(({ title, message, inputLabel, initialValue, inputProps }) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'prompt',
        title,
        message,
        inputLabel,
        initialValue,
        inputProps, // Pasar props adicionales al modal
        onConfirm: (value) => {
          closeModal();
          resolve(value);
        },
        onClose: () => {
          closeModal();
          resolve(null);
        },
      });
    });
  }, []);


  const value = { showAlert, showConfirmation, showPrompt };

  return (
    <ModalContext.Provider value={value}>
      {children}
      <Fragment>
        {modalConfig?.type === 'alert' && (
          <AlertModal
            open={true}
            title={modalConfig.title}
            onClose={modalConfig.onClose}
          >
            {modalConfig.message}
          </AlertModal>
        )}
        {modalConfig?.type === 'confirmation' && (
          <ConfirmationModal
            open={true}
            title={modalConfig.title}
            onConfirm={modalConfig.onConfirm}
            onClose={modalConfig.onClose}
          >
            {modalConfig.message}
          </ConfirmationModal>
        )}
        {modalConfig?.type === 'prompt' && (
          <PromptModal
            open={true}
            title={modalConfig.title}
            message={modalConfig.message}
            inputLabel={modalConfig.inputLabel}
            initialValue={modalConfig.initialValue}
            onConfirm={modalConfig.onConfirm}
            onClose={modalConfig.onClose}
            inputProps={modalConfig.inputProps} // Pasar las props al componente
          />
        )}
      </Fragment>
    </ModalContext.Provider>
  );
};