import './Privacy.css';

import { getTheiaCloudConfig } from '@eclipse-theiacloud/common';
import React from 'react';

import { ExtendedTheiaCloudConfig, PrivacyConfig } from '../common-extensions/types';

interface PrivacyProps {
    onNavigate?: (page: 'home' | 'imprint' | 'privacy') => void;
}

/**
 * What this installation does, as opposed to what TUM production does.
 *
 * The chart derives these from the settings that actually produce the
 * behaviour, so they cannot drift from the deployment. An installation on an
 * older chart sends nothing and gets TUM production's figures, which is what
 * this page stated unconditionally before.
 */
const FALLBACK: Required<PrivacyConfig> = {
    workspacePersistent: false,
    workspaceGarbageCollected: true,
    workspaceRetentionDays: 14,
    sessionMaxMinutes: 1440,
    sessionIdleMinutes: 60,
    scientificUse: false
};

const duration = (minutes: number, locale: 'de' | 'en'): string => {
    if (minutes % 1440 === 0) {
        const days = minutes / 1440;
        if (locale === 'de') {
            return days === 1 ? 'einem Tag' : `${days} Tagen`;
        }
        return days === 1 ? '1 day' : `${days} days`;
    }
    if (minutes % 60 === 0) {
        const hours = minutes / 60;
        if (locale === 'de') {
            return hours === 1 ? 'einer Stunde' : `${hours} Stunden`;
        }
        return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    return locale === 'de' ? `${minutes} Minuten` : `${minutes} minutes`;
};

export const Privacy: React.FC<PrivacyProps> = ({ onNavigate }) => {
    const config = getTheiaCloudConfig() as ExtendedTheiaCloudConfig | undefined;
    const privacy: Required<PrivacyConfig> = { ...FALLBACK, ...(config?.privacy ?? {}) };

    return (
        <div className='privacy'>
            <div className='privacy__container'>
                <div className='privacy__header'>
                    <h1>Datenschutzerklärung / Privacy Policy</h1>
                    <p>Datenschutzinformationen für TUM EduIDE</p>
                    <button onClick={() => (onNavigate ? onNavigate('home') : window.history.back())} className='privacy__back-btn'>
                        ← Back
                    </button>
                </div>

                <div className='privacy__content'>
                    <div className='privacy__card'>
                        <h2>1. Verantwortliche Stelle / Data Controller</h2>
                        <p>
                            Verantwortlich im Sinne der DSGVO ist die Technische Universität München (TUM), vertreten durch den Präsidenten.
                            Bei datenschutzrechtlichen Fragen wenden Sie sich bitte an:
                            <strong> beauftragter(at)datenschutz.tum.de</strong>
                        </p>
                        <hr className='privacy__lang-divider' />
                        <p>
                            The data controller within the meaning of the GDPR is the Technical University of Munich (TUM), represented by
                            its President. For data protection enquiries please contact:
                            <strong> beauftragter(at)datenschutz.tum.de</strong>
                        </p>
                    </div>

                    <div className='privacy__card'>
                        <h2>2. Verarbeitete Daten / Data Processed</h2>
                        <ul className='privacy__list'>
                            <li>
                                <strong>Anmeldedaten:</strong> E-Mail-Adresse und Benutzername aus dem TUM-SSO/Keycloak-JWT; nur im
                                Arbeitsspeicher während der Sitzung.
                            </li>
                            <li>
                                <strong>Sitzungsdaten:</strong> Workspace-Kennung, IDE-Typ, Zeitstempel der letzten Aktivität; gespeichert
                                in Kubernetes-Custom-Resources für das automatische Sitzungs-Timeout.
                            </li>
                            <li>
                                <strong>Git-Daten:</strong> Git-Benutzername, Git-E-Mail, temporäres VCS-Zugriffstoken; nur im
                                Arbeitsspeicher, wird über die Data Bridge injiziert und nicht persistiert.
                            </li>
                            <li>
                                <strong>Server-Logs:</strong> IP-Adresse und Anfrage-Zeitstempel (Standard-HTTP-Logs) in der
                                TUM-Infrastruktur.
                            </li>
                        </ul>
                        <hr className='privacy__lang-divider' />
                        <ul className='privacy__list'>
                            <li>
                                <strong>Login data:</strong> Email address and username from TUM SSO/Keycloak JWT; held in memory during the
                                session only.
                            </li>
                            <li>
                                <strong>Session data:</strong> Workspace identifier, IDE type, last-activity timestamp; stored in Kubernetes
                                custom resources for automatic session timeout.
                            </li>
                            <li>
                                <strong>Git data:</strong> Git username, Git email, temporary VCS access token; in-memory only, injected via
                                the Data Bridge and never persisted.
                            </li>
                            <li>
                                <strong>Server logs:</strong> IP address and request timestamps (standard HTTP logs) within TUM
                                infrastructure.
                            </li>
                        </ul>
                    </div>

                    <div className='privacy__card'>
                        <h2>3. Zweck der Verarbeitung / Purpose</h2>
                        <p>
                            Die Daten werden ausschließlich zur Bereitstellung der browserbasierten IDE-Lernumgebung für Lehrveranstaltungen
                            der TUM verarbeitet.
                        </p>
                        <hr className='privacy__lang-divider' />
                        <p>Data is processed solely to provide the browser-based IDE learning environment for TUM programming courses.</p>
                    </div>

                    <div className='privacy__card'>
                        <h2>4. Rechtsgrundlage / Legal Basis</h2>
                        <p>
                            Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. e DSGVO i.V.m. Art. 4 Abs. 1 BayDSG (öffentliche
                            Aufgabe der Hochschullehre). Ergänzend gilt das Bayerische Hochschulinnovationsgesetz (BayHIG).
                        </p>
                        <hr className='privacy__lang-divider' />
                        <p>
                            Processing is based on Art. 6(1)(e) GDPR in conjunction with Art. 4(1) BayDSG (public task of university
                            teaching). The Bayerisches Hochschulinnovationsgesetz (BayHIG) applies additionally.
                        </p>
                    </div>

                    <div className='privacy__card'>
                        <h2>5. Anonyme Telemetrie / Anonymous Telemetry</h2>
                        <p>
                            Zur Stabilitäts- und Leistungsüberwachung werden anonyme Absturzberichte und Performance-Traces über eine
                            TUM-interne Sentry-Instanz (<strong>sentry.aet.cit.tum.de</strong>) erfasst. Die Option{' '}
                            <code>send-default-pii=false</code> ist aktiv; es werden keine personenbezogenen Daten übertragen. Daten
                            verlassen nicht die TUM-Infrastruktur.
                        </p>
                        <hr className='privacy__lang-divider' />
                        <p>
                            For stability and performance monitoring, anonymous crash reports and performance traces are collected via a
                            TUM-internal Sentry instance (<strong>sentry.aet.cit.tum.de</strong>). The option{' '}
                            <code>send-default-pii=false</code> is enabled; no personally identifiable information is transmitted. Data does
                            not leave TUM infrastructure.
                        </p>
                        {privacy.scientificUse && (
                            <>
                                <hr className='privacy__lang-divider' />
                                <p>
                                    <strong>Wissenschaftliche Nutzung:</strong> Anonymisierte Nutzungsdaten dieser Installation können
                                    darüber hinaus für wissenschaftliche Forschungsprojekte und daraus hervorgehende Veröffentlichungen
                                    ausgewertet werden. Ein Rückschluss auf einzelne Personen ist dabei nicht möglich.
                                </p>
                                <hr className='privacy__lang-divider' />
                                <p>
                                    <strong>Scientific use:</strong> Anonymised usage data from this installation may additionally be
                                    analysed for scientific research projects and the publications arising from them. It cannot be traced
                                    back to an individual.
                                </p>
                            </>
                        )}
                    </div>

                    <div className='privacy__card'>
                        <h2>6. Empfänger / Recipients</h2>
                        <p>
                            Daten werden ausschließlich TUM-internen Diensten zugänglich gemacht. Es erfolgt keine Weitergabe an Dritte
                            außerhalb der TUM.
                        </p>
                        <hr className='privacy__lang-divider' />
                        <p>Data is made available to TUM-internal services only. No data is transferred to third parties outside TUM.</p>
                    </div>

                    <div className='privacy__card'>
                        <h2>7. Speicherdauer / Retention</h2>
                        <ul className='privacy__list'>
                            <li>
                                Eine Sitzung endet automatisch nach {privacy.sessionIdleMinutes} Minuten ohne Aktivität, spätestens nach{' '}
                                {duration(privacy.sessionMaxMinutes, 'de')}. Sitzungsdaten werden dabei gelöscht.
                            </li>
                            {privacy.workspacePersistent ? (
                                <li>
                                    Workspace-Daten bleiben über das Sitzungsende hinaus erhalten
                                    {privacy.workspaceGarbageCollected
                                        ? ` und werden ${privacy.workspaceRetentionDays} Tage nach der letzten Sitzung gelöscht.`
                                        : ' und werden nicht automatisch gelöscht.'}
                                </li>
                            ) : (
                                <li>
                                    Workspace-Daten werden mit dem Sitzungsende verworfen
                                    {privacy.workspaceGarbageCollected
                                        ? `; verbleibende Workspace-Objekte werden nach ${privacy.workspaceRetentionDays} Tagen entfernt.`
                                        : '.'}
                                </li>
                            )}
                            <li>Server-Logs werden nach spätestens 90 Tagen gelöscht.</li>
                        </ul>
                        <hr className='privacy__lang-divider' />
                        <ul className='privacy__list'>
                            <li>
                                A session ends automatically after {privacy.sessionIdleMinutes} minutes without activity, and after{' '}
                                {duration(privacy.sessionMaxMinutes, 'en')} at the latest. Session data is deleted at that point.
                            </li>
                            {privacy.workspacePersistent ? (
                                <li>
                                    Workspace data is kept beyond the end of the session
                                    {privacy.workspaceGarbageCollected
                                        ? ` and is deleted ${privacy.workspaceRetentionDays} days after the last session.`
                                        : ' and is not deleted automatically.'}
                                </li>
                            ) : (
                                <li>
                                    Workspace data is discarded when the session ends
                                    {privacy.workspaceGarbageCollected
                                        ? `; any remaining workspace records are removed after ${privacy.workspaceRetentionDays} days.`
                                        : '.'}
                                </li>
                            )}
                            <li>Server logs are deleted after at most 90 days.</li>
                        </ul>
                    </div>

                    <div className='privacy__card'>
                        <h2>8. Betroffenenrechte / Your rights</h2>
                        <p>Soweit wir personenbezogene Daten von Ihnen verarbeiten, stehen Ihnen als Betroffener folgende Rechte zu:</p>
                        <ul className='privacy__list'>
                            <li>Sie haben das Recht auf Auskunft (Art. 15 DSGVO).</li>
                            <li>
                                Werden unrichtige personenbezogene Daten verarbeitet, steht Ihnen ein Recht auf Berichtigung zu (Art. 16
                                DSGVO).
                            </li>
                            <li>
                                Liegen die gesetzlichen Voraussetzungen vor, können Sie die Löschung oder Einschränkung der Verarbeitung
                                verlangen (Art. 17 und 18 DSGVO).
                            </li>
                        </ul>

                        <hr className='privacy__lang-divider' />

                        <p>Insofar as we process personal data from you, you are entitled to the following rights as a data subject:</p>
                        <ul className='privacy__list'>
                            <li>You have the right of access (Art. 15 GDPR).</li>
                            <li>If incorrect personal data is processed, you have the right to rectification (Art. 16 GDPR).</li>
                            <li>
                                If the legal requirements are met, you may request the deletion or restriction of processing (Art. 17 and 18
                                GDPR).
                            </li>
                        </ul>
                    </div>

                    <div className='privacy__card'>
                        <h2>9. Datenschutzbeauftragter / Data Protection Officer</h2>
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
};
