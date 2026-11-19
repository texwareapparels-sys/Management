/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Employee } from './types';
import { subscribeEmployees, subscribeJobApplications, purgeAllDemoData, isDemoEmployee } from './lib/firebase';
import { initTelegramWebApp } from './lib/telegram';
import { Header, AppMode } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { CommandDashboard } from './components/CommandDashboard';
import { UserSalaryApp } from './components/UserSalaryApp';
import { AdminPanel, AdminTab } from './components/AdminPanel';
import { JobApplicationForm } from './components/JobApplicationForm';
import { WorkerPortal } from './components/WorkerPortal';
import { InvestmentHub } from './components/InvestmentHub';
import { InvestorPortal } from './components/InvestorPortal';
import { ResignationModal } from './components/ResignationModal';
import { ResignationLetterModal } from './components/ResignationLetterModal';
import { SuspensionNoticeModal } from './components/SuspensionNoticeModal';
import { TerminationNoticeModal } from './components/TerminationNoticeModal';
import { InstallAppModal } from './components/InstallAppModal';
import { Toast } from './components/Toast';

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppMode>('dashboard');
  const [tabHistory, setTabHistory] = useState<AppMode[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState<number>(0);
  const [urlWorkerId, setUrlWorkerId] = useState<string>('');
  const [urlInvestorId, setUrlInvestorId] = useState<string>('');
  const [urlMobile, setUrlMobile] = useState<string>('');
  const [urlToken, setUrlToken] = useState<string>('');
  const [resignationModalEmp, setResignationModalEmp] = useState<Employee | null>(null);
  const [resignationLetterEmp, setResignationLetterEmp] = useState<Employee | null>(null);
  const [suspensionNoticeEmp, setSuspensionNoticeEmp] = useState<Employee | null>(null);
  const [terminationNoticeEmp, setTerminationNoticeEmp] = useState<Employee | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const syncBrowserHistoryUrl = (tab: AppMode) => {
    if (typeof window !== 'undefined') {
      try {
        if (tab === 'worker') {
          window.history.replaceState(null, '', '/texwareworker');
        } else if (tab === 'investor') {
          window.history.replaceState(null, '', '/texwareinvestment');
        } else if (tab === 'dashboard' || tab === 'user') {
          window.history.replaceState(null, '', '/');
        }
      } catch {
        // Ignore iframe history errors if any
      }
    }
  };

  // Handle tab change and synchronize URL route without full reload
  const handleTabChange = (newTab: AppMode) => {
    setCurrentTab((prev) => {
      if (prev !== newTab) {
        setTabHistory((hist) => [...hist.slice(-19), prev]);
      }
      return newTab;
    });
    syncBrowserHistoryUrl(newTab);
  };

  // Step back to previous tab (or default to dashboard)
  const handleGoBack = () => {
    if (tabHistory.length > 0) {
      const prevTab = tabHistory[tabHistory.length - 1];
      setTabHistory((hist) => hist.slice(0, -1));
      setCurrentTab(prevTab);
      syncBrowserHistoryUrl(prevTab);
    } else if (currentTab !== 'dashboard') {
      setCurrentTab('dashboard');
      syncBrowserHistoryUrl('dashboard');
    }
  };

  // Dynamically update PWA Manifest and Document Title for Worker App vs Factory/Admin App
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isWorker = currentTab === 'worker';
    const titleEl = document.querySelector('title');
    const manifestEl = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const themeColorEl = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const appleTitleEl = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;

    const targetHref = isWorker ? '/worker-manifest.json' : '/manifest.json';
    if (manifestEl && manifestEl.getAttribute('href') !== targetHref) {
      manifestEl.setAttribute('href', targetHref);
    }

    if (isWorker) {
      if (titleEl) titleEl.innerText = 'টেক্স ওয়ার শ্রমিক অ্যাপ';
      if (themeColorEl) themeColorEl.content = '#0f766e';
      if (appleTitleEl) appleTitleEl.content = 'শ্রমিক অ্যাপ';
    } else {
      if (titleEl) titleEl.innerText = 'টেক্স ওয়ার অ্যাপারেলস - কারখানা ব্যবস্থাপনা';
      if (themeColorEl) themeColorEl.content = '#0f766e';
      if (appleTitleEl) appleTitleEl.content = 'টেক্স ওয়ার';
    }
  }, [currentTab]);

  // Subscribe to Firebase RTDB and synchronized local storage & Init Telegram
  useEffect(() => {
    initTelegramWebApp();
    if (typeof window !== 'undefined') {
      const pathname = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const mode = (params.get('mode') || '').toLowerCase();
      const tab = (params.get('tab') || '').toLowerCase();
      const portal = (params.get('portal') || '').toLowerCase();
      const admin = params.get('admin');

      const hasWorkerSession = (() => {
        try {
          return Boolean(localStorage.getItem('texware_worker_session'));
        } catch {
          return false;
        }
      })();
      const isAdminExplicit = mode === 'admin' || admin === 'true' || admin === '1';

      const isWorkerRoute =
        pathname.includes('texwareworker') ||
        pathname.endsWith('/worker') ||
        pathname === '/worker' ||
        hash.includes('texwareworker') ||
        hash.includes('worker') ||
        portal === 'texwareworker' ||
        portal === 'worker' ||
        mode === 'texwareworker' ||
        mode === 'worker' ||
        tab === 'worker' ||
        (hasWorkerSession && !isAdminExplicit && (pathname === '/' || pathname === ''));

      const isInvestorRoute =
        pathname.includes('texwareinvestment') ||
        hash.includes('texwareinvestment') ||
        portal === 'texwareinvestment' ||
        portal === 'investor' ||
        mode === 'texwareinvestment' ||
        mode === 'investor' ||
        tab === 'investor';

      const wid = params.get('workerId') || (!isInvestorRoute ? (params.get('id') || '') : '');
      const invId =
        params.get('investorId') ||
        params.get('agreementNo') ||
        params.get('investorCode') ||
        (isInvestorRoute ? (params.get('id') || '') : '');
      const mob = params.get('mobile') || params.get('investorMobile') || '';
      const tok = params.get('token') || params.get('key') || '';
      if (wid) setUrlWorkerId(wid);
      if (invId) setUrlInvestorId(invId);
      if (mob) setUrlMobile(mob);
      if (tok) setUrlToken(tok);

      if (isInvestorRoute) {
        setCurrentTab('investor');
        try {
          const search = window.location.search;
          window.history.replaceState(null, '', `/texwareinvestment${search}`);
        } catch { /* noop */ }
      } else if (isWorkerRoute) {
        setCurrentTab('worker');
        try {
          const search = window.location.search;
          window.history.replaceState(null, '', `/texwareworker${search}`);
        } catch { /* noop */ }
      } else if (mode === 'apply' || tab === 'apply') {
        setCurrentTab('apply');
      } else if (mode === 'applications' || tab === 'applications') {
        setCurrentTab('applications');
      } else if (mode === 'investment' || tab === 'investment') {
        setCurrentTab('investment');
      } else if (mode === 'user' || tab === 'user' || tab === 'calculator') {
        setCurrentTab('user');
      } else if (
        tab === 'attendance' ||
        tab === 'salaries' ||
        tab === 'form' ||
        tab === 'details' ||
        tab === 'password' ||
        tab === 'telegram' ||
        tab === 'sms' ||
        tab === 'factory'
      ) {
        setCurrentTab(tab as AppMode);
      } else if (mode === 'admin' || admin === 'true' || admin === '1') {
        setCurrentTab('admin');
      }
    }
    const unsubscribeEmps = subscribeEmployees((data) => {
      setEmployees(data);
    });
    const unsubscribeApps = subscribeJobApplications((apps) => {
      const p = apps.filter((a) => a.status === 'pending').length;
      setPendingApplicationsCount(p);
    });

    // নিশ্চিত করুন কোনো ডেমো কর্মী বা ডেমো হাজিরা অবশিষ্ট নেই
    purgeAllDemoData().catch(() => {});

    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const pathname = (window.location.pathname || '').toLowerCase();
      const hash = (window.location.hash || '').toLowerCase();
      if (pathname.includes('texwareworker') || hash.includes('texwareworker')) {
        setCurrentTab('worker');
      } else if (pathname.includes('texwareinvestment') || hash.includes('texwareinvestment')) {
        setCurrentTab('investor');
      } else if (pathname === '/' || pathname === '') {
        setCurrentTab('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      unsubscribeEmps();
      unsubscribeApps();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const cleanEmployees = employees.filter((e) => !isDemoEmployee(e));
  const activeEmployees = cleanEmployees.filter((e) => e.status === 'active');
  const resignedEmployees = cleanEmployees.filter((e) => e.status === 'resigned');
  const suspendedEmployees = cleanEmployees.filter((e) => e.status === 'suspended');
  const terminatedEmployees = cleanEmployees.filter((e) => e.status === 'terminated');

  const isStandalonePortal =
    currentTab === 'apply' || currentTab === 'investor' || currentTab === 'worker';

  const renderMainView = () => {
    if (currentTab === 'investor') {
      return (
        <InvestorPortal
          initialInvestorId={urlInvestorId}
          initialMobile={urlMobile}
          onBackToApp={handleGoBack}
          onSwitchToWorkerPortal={() => handleTabChange('worker')}
          showToast={showToast}
        />
      );
    }
    if (currentTab === 'worker') {
      return (
        <WorkerPortal
          employees={cleanEmployees}
          initialWorkerId={urlWorkerId}
          initialMobile={urlMobile}
          initialToken={urlToken}
          onBackToApp={tabHistory.length > 0 ? handleGoBack : undefined}
          showToast={showToast}
        />
      );
    }
    if (currentTab === 'apply') {
      return (
        <JobApplicationForm
          onBackToApp={handleGoBack}
          showToast={showToast}
          isStandalone={true}
        />
      );
    }
    if (currentTab === 'dashboard') {
      return (
        <CommandDashboard
          employees={cleanEmployees}
          pendingApplicationsCount={pendingApplicationsCount}
          onNavigate={handleTabChange}
          onOpenInstallModal={() => setShowInstallModal(true)}
        />
      );
    }
    if (currentTab === 'investment') {
      return (
        <InvestmentHub
          onBackToApp={handleGoBack}
          showToast={showToast}
          isAdmin={true}
        />
      );
    }
    if (currentTab === 'user') {
      return (
        <UserSalaryApp
          employees={cleanEmployees}
          onOpenResignationModal={(emp) => setResignationModalEmp(emp)}
          onOpenResignationLetter={(emp) => setResignationLetterEmp(emp)}
          onOpenSuspensionNotice={(emp) => setSuspensionNoticeEmp(emp)}
          onOpenTerminationNotice={(emp) => setTerminationNoticeEmp(emp)}
          showToast={showToast}
        />
      );
    }
    return (
      <AdminPanel
        employees={cleanEmployees}
        onOpenResignationModal={(emp) => setResignationModalEmp(emp)}
        onOpenResignationLetter={(emp) => setResignationLetterEmp(emp)}
        onOpenSuspensionNotice={(emp) => setSuspensionNoticeEmp(emp)}
        onOpenTerminationNotice={(emp) => setTerminationNoticeEmp(emp)}
        showToast={showToast}
        onBack={handleGoBack}
        initialTab={
          currentTab === 'admin'
            ? 'list'
            : currentTab === 'applications'
            ? 'applications'
            : (currentTab as AdminTab)
        }
        onTabChange={(tab) => {
          if (
            tab === 'attendance' ||
            tab === 'salaries' ||
            tab === 'form' ||
            tab === 'details' ||
            tab === 'password' ||
            tab === 'telegram' ||
            tab === 'sms' ||
            tab === 'factory' ||
            tab === 'applications'
          ) {
            handleTabChange(tab as AppMode);
          } else if (tab === 'list') {
            handleTabChange('admin');
          }
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {isStandalonePortal ? (
        currentTab === 'investor' ? (
          <main className="w-full min-h-screen">{renderMainView()}</main>
        ) : (
          <div className="w-full max-w-5xl mx-auto p-3 sm:p-5 pb-12">
            <main>{renderMainView()}</main>
          </div>
        )
      ) : (
        <div className="min-h-screen flex">
          <Sidebar
            currentTab={currentTab}
            onTabChange={handleTabChange}
            pendingApplicationsCount={pendingApplicationsCount}
            activeWorkersCount={activeEmployees.length}
            onOpenInstallModal={() => setShowInstallModal(true)}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />

          <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
            <Header
              currentTab={currentTab}
              onTabChange={handleTabChange}
              activeCount={activeEmployees.length}
              resignedCount={resignedEmployees.length}
              suspendedCount={suspendedEmployees.length}
              terminatedCount={terminatedEmployees.length}
              totalCount={cleanEmployees.length}
              pendingApplicationsCount={pendingApplicationsCount}
              onOpenInstallModal={() => setShowInstallModal(true)}
              onOpenMobileMenu={() => setMobileMenuOpen(true)}
              onBack={currentTab !== 'dashboard' ? handleGoBack : undefined}
            />

            <main className="flex-1 w-full max-w-[1400px] mx-auto p-3 sm:p-4 lg:p-6">
              {renderMainView()}
            </main>

            <footer className="border-t border-slate-200/90 bg-white py-3 px-4 sm:px-6 text-center text-[11px] text-slate-500 no-print">
              <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
                <span className="font-medium text-slate-600">© টেক্স ওয়ার অ্যাপারেলস — গার্মেন্টস এইচআর ও পে-রোল সিস্টেম</span>
                <span className="text-[10.5px] text-slate-400 font-mono">
                  রিয়েল-টাইম ক্লাউড ডেটাবেস · POS 58mm পে-স্লিপ · ইনভেস্টমেন্ট ও শ্রমিক পোর্টাল
                </span>
              </div>
            </footer>
          </div>
        </div>
      )}

      {/* Global Resignation / Status Modal */}
      <ResignationModal
        employee={resignationModalEmp}
        isOpen={Boolean(resignationModalEmp)}
        onClose={() => setResignationModalEmp(null)}
        onSuccess={(msg) => showToast(msg)}
        onOpenResignationLetter={(emp) => setResignationLetterEmp(emp)}
        onOpenSuspensionNotice={(emp) => setSuspensionNoticeEmp(emp)}
        onOpenTerminationNotice={(emp) => setTerminationNoticeEmp(emp)}
      />

      {/* Global Resignation Form A4 Modal (1-Click Print & PDF) */}
      <ResignationLetterModal
        employee={resignationLetterEmp}
        isOpen={Boolean(resignationLetterEmp)}
        onClose={() => setResignationLetterEmp(null)}
        showToast={showToast}
        onEmployeeUpdated={(updated) => {
          setResignationLetterEmp(updated);
        }}
      />

      {/* Global Suspension Notice A4 Modal (1-Click Print & PDF) */}
      <SuspensionNoticeModal
        employee={suspensionNoticeEmp}
        isOpen={Boolean(suspensionNoticeEmp)}
        onClose={() => setSuspensionNoticeEmp(null)}
        showToast={showToast}
        onEmployeeUpdated={(updated) => {
          setSuspensionNoticeEmp(updated);
        }}
      />

      {/* Global Termination Notice A4 Modal (1-Click Print & PDF) */}
      <TerminationNoticeModal
        employee={terminationNoticeEmp}
        isOpen={Boolean(terminationNoticeEmp)}
        onClose={() => setTerminationNoticeEmp(null)}
        showToast={showToast}
        onEmployeeUpdated={(updated) => {
          setTerminationNoticeEmp(updated);
        }}
      />

      {/* Install PWA Modal */}
      <InstallAppModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        mode={currentTab === 'worker' ? 'worker' : 'admin'}
      />

      {/* Global Toast */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
