/* eslint-disable react/prop-types */
import React, { useRef, useLayoutEffect } from "react"; // Import React hooks

export function Input({ className, type, onChange, numericFormat, ...props }) {
  const baseClasses = "w-full text-sm rounded-lg border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-francia-500 focus:border-francia-500 transition-all";
  
  const isPasswordInput = props.autoComplete === 'current-password';

  const isTransformable = !isPasswordInput && type !== 'email' && type !== 'password' && type !== 'date';
  const finalClassName = `${baseClasses} ${isTransformable ? 'uppercase' : ''} ${className || ""}`;

  // --- INICIO DE LA CORRECCIÓN ---

  const inputRef = useRef(null); // Ref to the <input> element
  const cursorRef = useRef(null); // Ref to store cursor position

  const handleInputChange = (e) => {
    if (onChange) {
      // 1. Store the current cursor position before state update
      cursorRef.current = e.target.selectionStart; 
      
      let { value } = e.target;

      // 2. Apply transformations as before
      if (numericFormat === 'comma') {
        value = value.replace(/\./g, ',');
      }

      if (isTransformable) {
        value = value.toUpperCase();
      }
      
      // 3. Create a synthetic event object to pass to the parent's onChange
      // This avoids mutating the original 'e' object (e.target.value = value)
      const syntheticEvent = {
        ...e,
        target: { ...e.target, value },
        currentTarget: { ...e.currentTarget, value },
      };
      
      // 4. Call the parent's onChange handler with the new event
      onChange(syntheticEvent);
      
      // The parent component will now update its state, triggering a re-render
      // of this Input component with a new `props.value`.
    }
  };

  // 5. After React re-renders (from parent state change) but before the
  // browser paints, this effect runs to restore the cursor position.
  useLayoutEffect(() => {
    // Check if the input is focused and we have a stored cursor position
    if (inputRef.current && cursorRef.current !== null && document.activeElement === inputRef.current) {
      // Restore the cursor position
      inputRef.current.setSelectionRange(cursorRef.current, cursorRef.current);
      // Reset the stored cursor position
      cursorRef.current = null; 
    }
    // This effect MUST run every time the `value` prop changes
  }, [props.value]); 

  // --- FIN DE LA CORRECCIÓN ---

  return (
    <input 
      {...props} 
      ref={inputRef} // Attach the ref to the real input element
      type={type} 
      onChange={handleInputChange} 
      className={finalClassName} 
    />
  );
}