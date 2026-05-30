export function mediaSupportError() {
  if (!navigator.mediaDevices?.getUserMedia) {
    if (window.isSecureContext === false) {
      return "카메라는 HTTPS 또는 localhost 환경에서만 사용할 수 있습니다.";
    }
    return "현재 브라우저에서 카메라 접근을 지원하지 않습니다.";
  }
  return "";
}

export function describeMediaError(error) {
  if (!error) return "카메라를 사용할 수 없습니다.";

  switch (error.name) {
    case "MediaUnsupportedError":
      return error.message;
    case "NotAllowedError":
    case "SecurityError":
      return "브라우저 또는 macOS 카메라 권한을 허용해주세요.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "사용 가능한 카메라를 찾을 수 없습니다.";
    case "NotReadableError":
    case "TrackStartError":
      return "다른 앱이 카메라를 사용 중입니다.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "저장된 카메라를 찾을 수 없어 기본 카메라로 다시 시도합니다.";
    default:
      return "카메라 연결을 확인해주세요.";
  }
}

export async function getVideoInputDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

async function getUserMediaWithVideo(video, audio = true) {
  return navigator.mediaDevices.getUserMedia({ video, audio });
}

export async function openAudioVideoStream(preferredDeviceId) {
  const supportError = mediaSupportError();
  if (supportError) {
    const error = new Error(supportError);
    error.name = "MediaUnsupportedError";
    throw error;
  }

  const attempts = preferredDeviceId
    ? [{ deviceId: { exact: preferredDeviceId } }, true]
    : [true];

  let lastError = null;
  for (const video of attempts) {
    try {
      return await getUserMediaWithVideo(video, true);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function openInterviewStream(preferredDeviceId) {
  try {
    const stream = await openAudioVideoStream(preferredDeviceId);
    return { stream, videoAvailable: stream.getVideoTracks().length > 0, error: null };
  } catch (videoError) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return { stream, videoAvailable: false, error: videoError };
    } catch (audioError) {
      return { stream: new MediaStream(), videoAvailable: false, error: audioError || videoError };
    }
  }
}

export function getStreamVideoDeviceId(stream) {
  return stream?.getVideoTracks?.()[0]?.getSettings?.().deviceId || "";
}
