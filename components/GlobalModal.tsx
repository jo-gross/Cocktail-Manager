import React, { useContext, useEffect } from "react";
import { ModalContext } from "../lib/context/ModalContextProvider";

interface GlobalModalProps {
  children: React.ReactNode;
}

export function GlobalModal(props: GlobalModalProps) {
  const modalContext = useContext(ModalContext);

  useEffect(() => {
    const handleEsc = (event: any) => {
      if (event.keyCode === 27) {
        modalContext.closeModal();
      }
    };
    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div>
      {props.children}
      <input
        type="checkbox"
        id="globalModal"
        className="modal-toggle"
      />
      <label htmlFor="globalModal" className="modal cursor-pointer">
        <label className="modal-box relative" htmlFor="">
          <label
            className={""}
            htmlFor=""
          >
            {modalContext.content}
          </label>
        </label>
      </label>
    </div>
  );
}
