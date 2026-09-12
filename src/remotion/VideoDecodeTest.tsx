import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

/** Throwaway: confirms Remotion can decode the uploaded HEVC phone clip. */
export const VideoDecodeTest = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <OffthreadVideo src={staticFile("raw-footage/clip1.mp4")} />
  </AbsoluteFill>
);

export default VideoDecodeTest;
