import './Privacy.css';

import React from 'react';

interface PrivacyProps {
    onNavigate?: (page: 'home' | 'imprint' | 'privacy') => void;
}

export const Privacy: React.FC<PrivacyProps> = ({ onNavigate }) => (
  <div className='privacy'>
    <div className='privacy__container'>
      <div className='privacy__header'>
        <h1>Datenschutzerklärung / Privacy Policy</h1>
        <p>Datenschutzinformationen für TUM EduIDE</p>
        <button onClick={() => onNavigate ? onNavigate('home') : window.history.back()} className='privacy__back-btn'>← Back</button>
      </div>

      <div className='privacy__content'>

        <div className='privacy__card'>
          <h2>1. Verantwortliche Stelle / Data Controller</h2>
          <p>
            Verantwortlich im Sinne der DSGVO ist die Technische Universität München (TUM),
            vertreten durch den Präsidenten.
            Bei datenschutzrechtlichen Fragen wenden Sie sich bitte an:
            <strong> beauftragter(at)datenschutz.tum.de</strong>
          </p>
          <hr className='privacy__lang-divider' />
          <p>
            The data controller within the meaning of the GDPR is the Technical University of Munich (TUM),
            represented by its President.
            For data protection enquiries please contact:
            <strong> beauftragter(at)datenschutz.tum.de</strong>
          </p>
        </div>

        <div className='privacy__card'>
          <h2>2. Verarbeitete Daten / Data Processed</h2>
          <ul className='privacy__list'>
            <li><strong>Anmeldedaten:</strong> E-Mail-Adresse und Benutzername aus dem TUM-SSO/Keycloak-JWT; nur im Arbeitsspeicher während der Sitzung.</li>
            <li><strong>Sitzungsdaten:</strong> Workspace-Kennung, IDE-Typ, Zeitstempel der letzten Aktivität;
              gespeichert in Kubernetes-Custom-Resources für das automatische Sitzungs-Timeout.</li>
            <li><strong>Git-Daten:</strong> Git-Benutzername, Git-E-Mail, temporäres VCS-Zugriffstoken;
              nur im Arbeitsspeicher, wird über die Data Bridge injiziert und nicht persistiert.</li>
            <li><strong>Server-Logs:</strong> IP-Adresse und Anfrage-Zeitstempel (Standard-HTTP-Logs) in der TUM-Infrastruktur.</li>
          </ul>
          <hr className='privacy__lang-divider' />
          <ul className='privacy__list'>
            <li><strong>Login data:</strong> Email address and username from TUM SSO/Keycloak JWT; held in memory during the session only.</li>
            <li><strong>Session data:</strong> Workspace identifier, IDE type, last-activity timestamp; stored in Kubernetes custom resources for automatic session timeout.</li>
            <li><strong>Git data:</strong> Git username, Git email, temporary VCS access token; in-memory only, injected via the Data Bridge and never persisted.</li>
            <li><strong>Server logs:</strong> IP address and request timestamps (standard HTTP logs) within TUM infrastructure.</li>
          </ul>
        </div>

        <div className='privacy__card'>
          <h2>3. Zweck der Verarbeitung / Purpose</h2>
          <p>
            Die Daten werden ausschließlich zur Bereitstellung der browserbasierten IDE-Lernumgebung
            für Lehrveranstaltungen der TUM verarbeitet.
          </p>
          <hr className='privacy__lang-divider' />
          <p>
            Data is processed solely to provide the browser-based IDE learning environment
            for TUM programming courses.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>4. Rechtsgrundlage / Legal Basis</h2>
          <p>
            Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. e DSGVO i.V.m.
            Art. 4 Abs. 1 BayDSG (öffentliche Aufgabe der Hochschullehre).
            Ergänzend gilt das Bayerische Hochschulinnovationsgesetz (BayHIG).
          </p>
          <hr className='privacy__lang-divider' />
          <p>
            Processing is based on Art. 6(1)(e) GDPR in conjunction with
            Art. 4(1) BayDSG (public task of university teaching).
            The Bayerisches Hochschulinnovationsgesetz (BayHIG) applies additionally.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>5. Anonyme Telemetrie / Anonymous Telemetry</h2>
          <p>
            Zur Stabilitäts- und Leistungsüberwachung werden anonyme Absturzberichte und
            Performance-Traces über eine TUM-interne Sentry-Instanz
            (<strong>sentry.aet.cit.tum.de</strong>) erfasst.
            Die Option <code>send-default-pii=false</code> ist aktiv; es werden keine
            personenbezogenen Daten übertragen.
            Daten verlassen nicht die TUM-Infrastruktur.
          </p>
          <hr className='privacy__lang-divider' />
          <p>
            For stability and performance monitoring, anonymous crash reports and performance
            traces are collected via a TUM-internal Sentry instance
            (<strong>sentry.aet.cit.tum.de</strong>).
            The option <code>send-default-pii=false</code> is enabled; no personally
            identifiable information is transmitted.
            Data does not leave TUM infrastructure.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>6. Empfänger / Recipients</h2>
          <p>
            Daten werden ausschließlich TUM-internen Diensten zugänglich gemacht.
            Es erfolgt keine Weitergabe an Dritte außerhalb der TUM.
          </p>
          <hr className='privacy__lang-divider' />
          <p>
            Data is made available to TUM-internal services only.
            No data is transferred to third parties outside TUM.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>7. Speicherdauer / Retention</h2>
          <ul className='privacy__list'>
            <li>Sitzungsdaten werden bei Sitzungsende gelöscht.</li>
            <li>Workspace-Daten werden nach 2 Wochen Inaktivitätsperiode entfernt.</li>
            <li>Server-Logs werden nach spätestens 90 Tagen gelöscht</li>
          </ul>
          <hr className='privacy__lang-divider' />
          <ul className='privacy__list'>
            <li>Session data is deleted when the session ends.</li>
            <li>Workspace data is removed after 2 weeks of inactivity.</li>
            <li>Server logs are deleted after at most 90 days.</li>
          </ul>
        </div>

<div className='privacy__card'>
          <h2>8. Betroffenenrechte / Your rights</h2>
          <p>
            Soweit wir personenbezogene Daten von Ihnen verarbeiten, stehen Ihnen als Betroffener folgende Rechte zu:
          </p>
          <ul className='privacy__list'>
            <li>Sie haben das Recht auf Auskunft (Art. 15 DSGVO).</li>
            <li>Werden unrichtige personenbezogene Daten verarbeitet, steht Ihnen ein Recht auf Berichtigung zu (Art. 16 DSGVO).</li>
            <li>Liegen die gesetzlichen Voraussetzungen vor, können Sie die Löschung oder Einschränkung der Verarbeitung verlangen (Art. 17 und 18 DSGVO).</li>
          </ul>

          <hr className='privacy__lang-divider' />

          <p>
            Insofar as we process personal data from you, you are entitled to the following rights as a data subject:
          </p>
          <ul className='privacy__list'>
            <li>You have the right of access (Art. 15 GDPR).</li>
            <li>If incorrect personal data is processed, you have the right to rectification (Art. 16 GDPR).</li>
            <li>If the legal requirements are met, you may request the deletion or restriction of processing (Art. 17 and 18 GDPR).</li>
          </ul>
        </div>

        <div className='privacy__card'>
          <h2>8. Datenschutzbeauftragter / Data Protection Officer</h2>
          <p>
            Den Datenschutzbeauftragten der TUM erreichen Sie unter:
            <strong> datenschutz(at)tum.de</strong>
          </p>
          <hr className='privacy__lang-divider' />
          <p>
            TUM&apos;s Data Protection Officer can be reached at:
            <strong> datenschutz(at)tum.de</strong>
          </p>
        </div>

      </div>
    </div>
  </div>
);
