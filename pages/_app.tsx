import { AppProps } from "next/app";
import "../styles/global.css";
import { GlobalModal } from "../components/GlobalModal";
import { useState } from "react";
import { ModalContext } from "../lib/context/ModalContextProvider";

const App = ({ Component, pageProps }: AppProps) => {

  const [modalContent, setModalContent] = useState(<></>);

  return <ModalContext.Provider
    value={{
      content: modalContent,
      openModal: content => {
        setModalContent(content);
        if ((document.getElementById("globalModal") as HTMLInputElement | null)?.checked == false) {
          document.getElementById("globalModal")?.click();
        }
      },
      closeModal() {
        if ((document.getElementById("globalModal") as HTMLInputElement | null)?.checked == true) {
          document.getElementById("globalModal")?.click();
        }
        setModalContent(<></>);
      }
    }}
  ><GlobalModal>
    <Component {...pageProps} />
  </GlobalModal>
  </ModalContext.Provider>;
};

export default App;
