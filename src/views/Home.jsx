import React from "react";
import { Routes, Route } from "react-router-dom";
import styled from "styled-components";
import CookieNotice, { useCookieConsent } from "./CookieNotice";

import useLocalStorage from "../hooks/useLocalStorage";
import useQueryParam from "../hooks/useQueryParam";

import HomeNav from "./HomeNav";
import GameListView from "./GameListView";
import GameStudio from "./GameStudio";

const StyledHome = styled.div`
  min-height: 100vh;
  flex-direction: column;
  & > footer {
    width: 100%;
    grid-column: 1 / 4;
    padding: 0.5em 0;
    text-align: center;
    background-color: #00000099;
  }
`;

const Home = () => {
  const cookieConsent = useCookieConsent();

  const [isBeta, setIsBeta] = useLocalStorage("isBeta", false);

  if (isBeta) {
    console.log("Beta activated");
  }

  let query = useQueryParam();

  const forceBeta = query.get("beta") === "true";

  React.useEffect(() => {
    if (forceBeta) {
      setIsBeta(true);
    }
  }, [forceBeta, setIsBeta]);

  return (
    <>
      <StyledHome>
        <HomeNav cookieConsent={cookieConsent} />
        <Routes>
          <Route path="games" element={<GameListView />} />
          {/* Hidden entry point: shows the login button even when VITE_HIDE_LOGIN=1 */}
          <Route path="members" element={<GameListView />} />
          <Route path="studio" element={<GameStudio />} />
        </Routes>
      </StyledHome>

      <CookieNotice />
    </>
  );
};

export default Home;
