import React from "react";
import { useTranslation } from "react-i18next";
import { Trans } from "react-i18next";

import Modal from "../ui/Modal";
import { SOURCE_URL } from "../utils/settings";

const UPSTREAM_URL = "https://github.com/jrmi/airboardgame";

const AboutModal = ({ show, setShow }) => {
  const { t } = useTranslation();

  return (
    <Modal
      title={t("About")}
      setShow={setShow}
      show={show}
      footer={
        <div style={{ display: "flex", justifyContent: "end" }}>
          <button
            onClick={() => {
              setShow(false);
            }}
            className="button"
          >
            {t("Close")}
          </button>
        </div>
      }
    >
      {/* Fork notice instead of the upstream text, which names the original
          site's hosting and contact address. */}
      <Trans i18nKey="aboutFork">
        <p>
          This site is an unofficial version of <a href={UPSTREAM_URL} target="_blank" rel="noreferrer">AirBoardGame</a> by Jérémie Pardou and contributors, translated into Japanese by volunteers under the MIT License and renamed. It is not affiliated with the original author. Please send questions or bug reports about this version to the administrator of this server, not to the original author. The source code of this version is available on <a href={SOURCE_URL} target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </Trans>
    </Modal>
  );
};
export default AboutModal;
