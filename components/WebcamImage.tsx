import Webcam from 'react-webcam';
import React, { useCallback, useRef } from 'react';
import { Loading } from './Loading';

interface WebcamImageProps {
  onCapture: (imageSrc: string | undefined) => void;
}

function WebcamImage(props: WebcamImageProps) {
  const webcamRef = useRef<Webcam>(null);
  const capture = useCallback(() => {
    const imageSrc = webcamRef?.current?.getScreenshot();
    console.log(imageSrc);
    props.onCapture(imageSrc ?? undefined);
  }, [props]);

  const videoConstraints: MediaTrackConstraints = {
    width: 250,
    height: 500,
    facingMode: 'user',
  };

  return (
    <div>
      {webcamRef == undefined ? (
        <>
          <Loading />
        </>
      ) : (
        <div className={'relative'}>
          <Webcam
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            audio={false}
            className={'w-full'}
            ref={webcamRef}
            mirrored={false}
          />
          <div className={'absolute bottom-2 flex w-full flex-col items-center justify-center'}>
            <div className={'btn btn-primary w-2/3'} onClick={capture}>
              Aufnehmen
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WebcamImage;
