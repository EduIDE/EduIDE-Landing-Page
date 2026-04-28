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

        {/* ── GERMAN ── */}
        <div className='privacy__card'>
          <h2>1. Verantwortliche Stelle</h2>
          <p>
            Verantwortlich im Sinne der DSGVO ist die Technische Universität München (TUM),
            vertreten durch den Präsidenten.
            Bei datenschutzrechtlichen Fragen wenden Sie sich bitte an:
            <strong> datenschutz(at)tum.de</strong>
          </p>
        </div>

        <div className='privacy__card'>
          <h2>2. Verarbeitete Daten</h2>
          <ul className='privacy__list'>
            <li><strong>Anmeldedaten:</strong> E-Mail-Adresse und Benutzername aus dem TUM-SSO/Keycloak-JWT; nur im Arbeitsspeicher während der Sitzung.</li>
            <li><strong>Sitzungsdaten:</strong> Workspace-Kennung, IDE-Typ, Zeitstempel der letzten Aktivität; gespeichert in Kubernetes-Custom-Resources für das automatische Sitzungs-Timeout.</li>
            <li><strong>Git-Daten:</strong> Git-Benutzername, Git-E-Mail, temporäres VCS-Zugriffstoken; nur im Arbeitsspeicher, wird über die Data Bridge injiziert und nicht persistiert.</li>
            <li><strong>Server-Logs:</strong> IP-Adresse und Anfrage-Zeitstempel (Standard-HTTP-Logs) in der TUM-Infrastruktur.</li>
          </ul>
        </div>

        <div className='privacy__card'>
          <h2>3. Zweck der Verarbeitung</h2>
          <p>
            Die Daten werden ausschließlich zur Bereitstellung der browserbasierten IDE-Lernumgebung
            für Lehrveranstaltungen der TUM verarbeitet.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>4. Rechtsgrundlage</h2>
          <p>
            Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. e DSGVO i.V.m.
            Art. 4 Abs. 1 BayHSchG (öffentliche Aufgabe der Hochschullehre).
            Ergänzend gilt das Bayerische Datenschutzgesetz (BayDSG).
          </p>
        </div>

        <div className='privacy__card'>
          <h2>5. Anonyme Telemetrie</h2>
          <p>
            Zur Stabilitäts- und Leistungsüberwachung werden anonyme Absturzberichte und
            Performance-Traces über eine TUM-interne Sentry-Instanz
            (<strong>sentry.aet.cit.tum.de</strong>) erfasst.
            Die Option <code>send-default-pii=false</code> ist aktiv; es werden keine
            personenbezogenen Daten übertragen.
            Daten verlassen nicht die TUM-Infrastruktur.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>6. Empfänger</h2>
          <p>
            Daten werden ausschließlich TUM-internen Diensten zugänglich gemacht.
            Es erfolgt keine Weitergabe an Dritte außerhalb der TUM.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>7. Speicherdauer</h2>
          <ul className='privacy__list'>
            <li>Sitzungsdaten werden bei Sitzungsende gelöscht.</li>
            <li>Workspace-Daten werden nach einer definierten Inaktivitätsperiode entfernt.</li>
            <li>Server-Logs werden gemäß den TUM-Richtlinien aufbewahrt.</li>
          </ul>
        </div>

        <div className='privacy__card'>
          <h2>8. Ihre Rechte</h2>
          <p>Sie haben nach Art. 15–21 DSGVO das Recht auf:</p>
          <ul className='privacy__list'>
            <li>Auskunft (Art. 15 DSGVO)</li>
            <li>Berichtigung (Art. 16 DSGVO)</li>
            <li>Löschung (Art. 17 DSGVO)</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch (Art. 21 DSGVO)</li>
          </ul>
          <p>
            Beschwerden können Sie beim Bayerischen Landesbeauftragten für den Datenschutz
            (BayLfD) einreichen.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>9. Datenschutzbeauftragter</h2>
          <p>
            Den Datenschutzbeauftragten der TUM erreichen Sie unter:
            <strong> datenschutz(at)tum.de</strong>
          </p>
        </div>

        {/* ── ENGLISH ── */}
        <div className='privacy__card'>
          <h2>1. Data Controller</h2>
          <p>
            The data controller within the meaning of the GDPR is the Technical University of Munich (TUM),
            represented by its President.
            For data protection enquiries please contact:
            <strong> datenschutz(at)tum.de</strong>
          </p>
        </div>

        <div className='privacy__card'>
          <h2>2. Data Processed</h2>
          <ul className='privacy__list'>
            <li><strong>Login data:</strong> Email address and username from TUM SSO/Keycloak JWT; held in memory during the session only.</li>
            <li><strong>Session data:</strong> Workspace identifier, IDE type, last-activity timestamp; stored in Kubernetes custom resources for automatic session timeout.</li>
            <li><strong>Git data:</strong> Git username, Git email, temporary VCS access token; in-memory only, injected via the Data Bridge and never persisted.</li>
            <li><strong>Server logs:</strong> IP address and request timestamps (standard HTTP logs) within TUM infrastructure.</li>
          </ul>
        </div>

        <div className='privacy__card'>
          <h2>3. Purpose</h2>
          <p>
            Data is processed solely to provide the browser-based IDE learning environment
            for TUM programming courses.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>4. Legal Basis</h2>
          <p>
            Processing is based on Art. 6(1)(e) GDPR in conjunction with
            Art. 4(1) BayHSchG (Bayerisches Hochschulgesetz - public task of university teaching).
            The Bayerisches Datenschutzgesetz (BayDSG) applies additionally.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>5. Anonymous Telemetry</h2>
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
          <h2>6. Recipients</h2>
          <p>
            Data is made available to TUM-internal services only.
            No data is transferred to third parties outside TUM.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>7. Retention</h2>
          <ul className='privacy__list'>
            <li>Session data is deleted when the session ends.</li>
            <li>Workspace data is removed after a defined inactivity period.</li>
            <li>Server logs are retained in accordance with TUM policy.</li>
          </ul>
        </div>

        <div className='privacy__card'>
          <h2>8. Your Rights</h2>
          <p>Under Art. 15-21 GDPR you have the right to:</p>
          <ul className='privacy__list'>
            <li>Access your personal data (Art. 15 GDPR)</li>
            <li>Rectify inaccurate data (Art. 16 GDPR)</li>
            <li>Erase your data (Art. 17 GDPR)</li>
            <li>Restrict processing (Art. 18 GDPR)</li>
            <li>Data portability (Art. 20 GDPR)</li>
            <li>Object to processing (Art. 21 GDPR)</li>
          </ul>
          <p>
            You may lodge a complaint with the Bayerischer Landesbeauftragter für den Datenschutz
            (BayLfD), the Bavarian State Commissioner for Data Protection.
          </p>
        </div>

        <div className='privacy__card'>
          <h2>9. Data Protection Officer</h2>
          <p>
            TUM's Data Protection Officer can be reached at:
            <strong> datenschutz(at)tum.de</strong>
          </p>
        </div>

      </div>
    </div>
  </div>
);
