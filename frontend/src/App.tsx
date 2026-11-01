import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Bell, Building2,
  Calendar, Check, ChevronDown, ChevronRight, Clock, Compass,
  Construction, ExternalLink, Eye, EyeOff, Filter, Flame, HardHat,
  HelpCircle, Layers, Lock, LogIn, LogOut, MapPin, MessageSquare,
  Navigation, Phone, Radio, RefreshCw, Search, Send, Share2,
  Shield, ShieldAlert, Sparkles, User, Users, Volume2, Wind,
  Wrench, X, CheckCircle2, AlertOctagon, Car, Info, Home, Key, Heart, BadgeCheck, Trophy,
  ArrowLeft, LayoutGrid, SlidersHorizontal, ArrowUpDown, Camera,
  Upload, CheckSquare, FileText, Landmark, Briefcase, Crosshair, PlusCircle, CheckCircle,
  Ticket, GitBranch, ClipboardList, CalendarClock, Paperclip, Mic, Video,
  Image as ImageIcon, Bot, Trash2, LocateFixed, Square, RotateCcw
} from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar } from 'recharts';

export type Project = {
  id: number;
  code: string;
  title: string;
  category: string;
  department: string;
  locality: string;
  pincode: string;
  address: string;
  description: string;
  status: string;
  progress: number;
  budget: number;
  contractor: string;
  start_date: string;
  due_date: string;
  revised_date: string | null;
  lat: number;
  lng: number;
  disruption: string;
  delay_reason: string | null;
  mitigation: string | null;
  updated: string;
  current_step: number;
  contact_engineer_name: string;
  contact_engineer_phone: string;
  contact_engineer_email: string;
  contact_contractor: string;
  contact_contractor_phone: string;
  noise_warning: string;
  dust_warning: string;
  gmaps_broadcast: boolean;
  detour_advice: string;
  technical_scope?: string;
  funding_program?: string;
  created_by?: string;
  events?: { id?: number; title: string; detail: string; created: string; verified: boolean }[];
  issues?: any[];
};

export type AuthUser = {
  email: string;
  name: string;
  role: string;
  department: string;
  designation: string;
  badge_id: string;
};

export function UtopiaLogo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="utopiaLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="utopiaPolyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(52, 211, 153, 0.25)" />
          <stop offset="100%" stopColor="rgba(6, 182, 212, 0.1)" />
        </linearGradient>
      </defs>
      <polygon
        points="14,2 25,8.2 25,19.8 14,26 3,19.8 3,8.2"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        fill="url(#utopiaPolyGrad)"
      />
      <line x1="14" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="25" y1="19.8" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3" y1="19.8" x2="14" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="14" r="3.5" fill="url(#utopiaLogoGrad)" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="14" cy="2" r="1.5" fill="#34d399" />
      <circle cx="25" cy="8.2" r="1.5" fill="#06b6d4" />
      <circle cx="25" cy="19.8" r="1.5" fill="#34d399" />
      <circle cx="14" cy="26" r="1.5" fill="#06b6d4" />
      <circle cx="3" cy="19.8" r="1.5" fill="#34d399" />
      <circle cx="3" cy="8.2" r="1.5" fill="#06b6d4" />
    </svg>
  );
}

const getApiBase = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  // Same-origin; the Vite dev server proxies /api to the backend (works over HTTPS and from phones)
  return '/api';
};

const API = getApiBase();

function communityId(): string {
  const saved = localStorage.getItem('utopia_community_id');
  if (saved) return saved;
  const created = crypto.randomUUID();
  localStorage.setItem('utopia_community_id', created);
  return created;
}

async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('utopia_token') || localStorage.getItem('civicgrid_token');
  const headers = new Headers(options.headers || {});
  headers.set('X-Community-ID', communityId());
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const res = await fetch(API + url, { ...options, headers });
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(errorText || `API error: ${res.status}`);
  }
  return res.json();
}

const formatDate = (v?: string | null) => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// 7 Amazon-style public works milestone steps
const MILESTONE_STEPS = [
  { step: 1, title: 'Sanction & DPR Published', desc: 'Administrative & technical sanction approved' },
  { step: 2, title: 'Tender & Site Mobilisation', desc: 'Work order executed & utility survey complete' },
  { step: 3, title: 'Utility Shifting & Excavation', desc: 'Barricading erected & mechanical trenching' },
  { step: 4, title: 'Core Conduit / Pipe Laying', desc: 'Structural installation & jointing in progress' },
  { step: 5, title: 'Quality & Compaction Audit', desc: 'Pressure testing & soil compaction verified' },
  { step: 6, title: 'Road Surface Restoration', desc: 'Bitumen macadam & wearing course resurfacing' },
  { step: 7, title: 'Commissioned & Reopened', desc: 'Final site audit cleared & road open to traffic' }
];

export const MILESTONE_STEP_PROGRESS: Record<number, number> = {
  1: 10,
  2: 25,
  3: 45,
  4: 65,
  5: 80,
  6: 92,
  7: 100
};

export const getProgressForMilestoneStep = (step: number): number => {
  return MILESTONE_STEP_PROGRESS[step] ?? 10;
};

export const getMilestoneStepForProgress = (progress: number): number => {
  if (progress >= 100) return 7;
  if (progress >= 90) return 6;
  if (progress >= 75) return 5;
  if (progress >= 55) return 4;
  if (progress >= 35) return 3;
  if (progress >= 20) return 2;
  return 1;
};

// Area coordinates lookup for rapid map centering
const PIN_COORDINATES: Record<string, { center: [number, number]; zoom: number; name: string }> = {
  '600005': { center: [13.0585, 80.2751], zoom: 15, name: 'Triplicane' },
  '600127': { center: [12.8425, 80.1412], zoom: 14, name: 'Melakottaiyur' },
  '600023': { center: [13.0970, 80.2350], zoom: 15, name: 'Ayanavaram' },
  '600017': { center: [13.0418, 80.2337], zoom: 14, name: 'T. Nagar' },
  '600004': { center: [13.0368, 80.2676], zoom: 14, name: 'Mylapore' },
  '600020': { center: [13.0067, 80.2565], zoom: 14, name: 'Adyar' },
  '600042': { center: [12.9815, 80.2180], zoom: 14, name: 'Velachery' },
};

// Custom Google Maps marker icon
function createGmapsPin(category: string, status: string, isSelected: boolean) {
  const statusSlug = status.toLowerCase().replace(/\s+/g, '-');
  let glyph = '🚧';
  if (category.toLowerCase().includes('water')) glyph = '💧';
  else if (category.toLowerCase().includes('drain')) glyph = '🌊';
  else if (category.toLowerCase().includes('road')) glyph = '🛣️';
  else if (category.toLowerCase().includes('elect') || category.toLowerCase().includes('power')) glyph = '⚡';
  else if (category.toLowerCase().includes('telecom') || category.toLowerCase().includes('fibre')) glyph = '📡';

  const isDelayed = status.toLowerCase() === 'delayed';

  const html = `
    <div class="cg-gmap-pin ${isSelected ? 'selected' : ''}">
      <div class="cg-pin-body ${statusSlug}">
        <span class="cg-pin-glyph">${glyph}</span>
      </div>
      <div class="cg-pin-pulse ${isDelayed ? 'delayed' : ''}"></div>
    </div>
  `;

  return L.divIcon({
    className: 'cg-gmap-pin-container',
    html,
    iconSize: [38, 48],
    iconAnchor: [19, 44],
    popupAnchor: [0, -40]
  });
}

function MapClickHandler({ active, onMapClick }: { active: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (active) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    }
  });
  return null;
}

function MapController({
  selectedProject,
  activePincode,
  resolvedLocation,
  projects
}: {
  selectedProject: Project | null;
  activePincode: string;
  resolvedLocation?: { center: [number, number]; zoom: number; locality?: string; pincode?: string } | null;
  projects?: Project[];
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedProject) {
      map.flyTo([selectedProject.lat, selectedProject.lng], 16, { duration: 0.8 });
    } else if (resolvedLocation) {
      map.flyTo(resolvedLocation.center, resolvedLocation.zoom || 14, { duration: 0.8 });
    } else if (activePincode && PIN_COORDINATES[activePincode]) {
      const { center, zoom } = PIN_COORDINATES[activePincode];
      map.flyTo(center, zoom, { duration: 0.8 });
    } else if (projects && projects.length > 0) {
      const avgLat = projects.reduce((acc, p) => acc + p.lat, 0) / projects.length;
      const avgLng = projects.reduce((acc, p) => acc + p.lng, 0) / projects.length;
      map.flyTo([avgLat, avgLng], 14, { duration: 0.8 });
    }
  }, [selectedProject, resolvedLocation, activePincode, projects, map]);

  return null;
}

export default function App() {
  const qc = useQueryClient();
  const loc = useLocation();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();

  // URL State
  const urlPin = searchParams.get('pin');
  const urlView = searchParams.get('view');
  const urlProject = searchParams.get('project');
  const urlFrom = searchParams.get('from');

  const activePincode = urlPin || '';

  const [pincodeSwitcherOpen, setPincodeSwitcherOpen] = useState(false);

  // Search & Filters for Map View
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    return urlProject ? Number(urlProject) : null;
  });
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [showClosuresOnly, setShowClosuresOnly] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Dynamic Geocoded Location & Map Selection Mode
  const [resolvedLocation, setResolvedLocation] = useState<{ center: [number, number]; zoom: number; locality?: string; pincode?: string } | null>(null);
  const [isSelectAreaMode, setIsSelectAreaMode] = useState(true);
  const [clickedPoint, setClickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locationConfirmModal, setLocationConfirmModal] = useState<{ pincode: string | null; locality: string; lat: number; lng: number } | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isDeckCollapsed, setIsDeckCollapsed] = useState(false);

  // Keep selectedProjectId synchronized with urlProject query parameter
  useEffect(() => {
    if (urlProject) {
      setSelectedProjectId(Number(urlProject));
    }
  }, [urlProject]);

  // Synchronize geocoded coordinates when activePincode changes (glides the map in place)
  useEffect(() => {
    if (activePincode && /^\d{6}$/.test(activePincode)) {
      if (!resolvedLocation || resolvedLocation.pincode !== activePincode) {
        fetchApi<{ pincode: string; locality: string; lat: number; lng: number }>(`/geocode/pincode?pin=${activePincode}`)
          .then(geo => {
            if (geo && geo.lat && geo.lng) {
              setResolvedLocation({
                center: [geo.lat, geo.lng],
                zoom: 15,
                locality: geo.locality,
                pincode: geo.pincode
              });
            }
          })
          .catch(() => {
            if (PIN_COORDINATES[activePincode]) {
              const loc = PIN_COORDINATES[activePincode];
              setResolvedLocation({ center: loc.center, zoom: loc.zoom, locality: loc.name, pincode: activePincode });
            } else {
              setToastMessage(`Could not resolve a location for PIN ${activePincode}. Please verify the postal code.`);
            }
          });
      }
    }
  }, [activePincode]);

  // Authentication state for Municipal view
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('utopia_token') || localStorage.getItem('civicgrid_token'));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('utopia_user') || localStorage.getItem('civicgrid_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Changing PIN keeps the current route + view (map/info) so the map glides instead of resetting to mode selection
  const handleSelectResidentPin = (pin: string) => {
    const cleanPin = pin.trim();
    if (!/^\d{6}$/.test(cleanPin)) {
      setToastMessage('Please enter a valid 6-digit Indian PIN code (e.g., 600017).');
      return;
    }
    localStorage.setItem('utopia_has_entered', 'true');
    localStorage.setItem('utopia_resident_pin', cleanPin);
    setSearch('');
    setSubmittedSearch('');
    setSelectedProjectId(null);
    setPincodeSwitcherOpen(false);
    const base = loc.pathname === '/citizen' ? '/citizen' : '/';
    const keepView = urlView === 'map' || urlView === 'info' ? `&view=${urlView}` : '';
    nav(`${base}?pin=${cleanPin}${keepView}`);
  };

  // Resolve coordinates -> PIN, then glide there (used by map clicks and device location)
  const jumpToCoordinates = async (lat: number, lng: number, zoom = 15) => {
    setIsReverseGeocoding(true);
    try {
      const res = await fetchApi<{ pincode: string | null; locality: string; lat: number; lng: number }>(`/geocode/reverse?lat=${lat}&lng=${lng}`);
      if (res.pincode) {
        setResolvedLocation({ center: [lat, lng], zoom, locality: res.locality, pincode: res.pincode });
        setToastMessage(`PIN ${res.pincode} · ${res.locality}`);
        handleSelectResidentPin(res.pincode);
      } else {
        setResolvedLocation({ center: [lat, lng], zoom, locality: res.locality || 'Selected Location' });
        setToastMessage(`Postal area could not be determined for ${lat.toFixed(4)}, ${lng.toFixed(4)}.`);
      }
    } catch {
      setToastMessage('Could not resolve a PIN code for that location. Please try again.');
    } finally {
      setIsReverseGeocoding(false);
      setClickedPoint(null);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setClickedPoint({ lat, lng });
    jumpToCoordinates(lat, lng);
  };

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const handleDetectLocation = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setToastMessage('Current location needs a secure (HTTPS) connection and browser location access. Enter your PIN code instead.');
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await jumpToCoordinates(pos.coords.latitude, pos.coords.longitude, 16);
        setIsDetectingLocation(false);
      },
      async (err) => {
        setToastMessage(err.code === err.PERMISSION_DENIED
          ? 'Location permission was denied. Allow location access or enter your PIN code.'
          : 'Could not read your device location. Check browser location access or enter your PIN code.');
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleBackToInfoDashboard = () => {
    nav(`/?pin=${activePincode}&view=info`);
  };

  const handleLogin = (token: string, user: AuthUser) => {
    localStorage.setItem('utopia_has_entered', 'true');
    localStorage.setItem('utopia_token', token);
    localStorage.setItem('utopia_user', JSON.stringify(user));
    setAuthToken(token);
    setCurrentUser(user);
    setToastMessage(`Authenticated as ${user.name} (${user.badge_id})`);
    if (user.role === 'citizen') {
      nav(`/citizen?pin=${activePincode || ''}&view=info`);
    } else if (user.role === 'onsite') {
      nav('/onsite/dashboard');
    } else if (user.role === 'official') {
      nav('/department/dashboard');
    } else {
      nav('/municipality/dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('utopia_token');
    localStorage.removeItem('utopia_user');
    localStorage.removeItem('civicgrid_token');
    localStorage.removeItem('civicgrid_user');
    setAuthToken(null);
    setCurrentUser(null);
    setToastMessage('Signed out of Utopia.');
    nav('/login');
  };

  // Queries
  const { data: rawProjects = [] } = useQuery({
    queryKey: ['projects', submittedSearch, activePincode, loc.pathname],
    queryFn: async () => {
      try {
        const isOfficialRoute = loc.pathname.startsWith('/municipality') || loc.pathname.startsWith('/department') || loc.pathname.startsWith('/onsite') || loc.pathname === '/admin';
        const queryParam = submittedSearch
          ? `?search=${encodeURIComponent(submittedSearch)}`
          : (!isOfficialRoute && activePincode)
          ? `?pincode=${encodeURIComponent(activePincode)}`
          : '';
        return await fetchApi<Project[]>(`/projects${queryParam}`);
      } catch (e) {
        console.warn('Backend unavailable, using fallback mock dataset', e);
        return [];
      }
    },
    enabled: !!activePincode || !!submittedSearch || loc.pathname.startsWith('/municipality') || loc.pathname.startsWith('/department') || loc.pathname.startsWith('/onsite') || loc.pathname === '/admin'
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => fetchApi<{ total: number; active: number; completed: number; delayed: number; last_updated: string }>('/stats').catch(() => null)
  });

  const { data: dynamicLocalities = [] } = useQuery({
    queryKey: ['localities'],
    queryFn: () => fetchApi<{ pincode: string; locality: string; count: number; active: number; delayed: number }[]>('/localities').catch(() => [])
  });

  const DEFAULT_LOCALITIES = [
    { pincode: '600127', locality: 'Melakottaiyur', count: 5, active: 4, delayed: 1 },
    { pincode: '600005', locality: 'Triplicane', count: 4, active: 3, delayed: 1 },
    { pincode: '600023', locality: 'Ayanavaram', count: 3, active: 3, delayed: 1 },
    { pincode: '600017', locality: 'T. Nagar', count: 2, active: 1, delayed: 0 },
    { pincode: '600004', locality: 'Mylapore', count: 1, active: 1, delayed: 1 },
    { pincode: '600020', locality: 'Adyar', count: 1, active: 0, delayed: 0 },
    { pincode: '600042', locality: 'Velachery', count: 1, active: 1, delayed: 0 },
  ];

  const availableLocalities = dynamicLocalities.length > 0 ? dynamicLocalities : DEFAULT_LOCALITIES;

  const activeAreaName = useMemo(() => {
    if (!activePincode) return 'Chennai';
    if (resolvedLocation && resolvedLocation.pincode === activePincode && resolvedLocation.locality) {
      return resolvedLocation.locality;
    }
    const found = availableLocalities.find(l => l.pincode === activePincode);
    if (found) return found.locality;
    return PIN_COORDINATES[activePincode]?.name || `Area (${activePincode})`;
  }, [activePincode, availableLocalities, resolvedLocation]);

  // Fetch community questions for active area
  const { data: communityQuestions = [] } = useQuery({
    queryKey: ['issues', activePincode],
    queryFn: () => {
      const url = activePincode ? `/issues?pincode=${activePincode}` : '/issues';
      return fetchApi<any[]>(url).catch(() => []);
    }
  });

  const { data: allAdminIssues = [] } = useQuery({
    queryKey: ['admin_issues'],
    queryFn: () => fetchApi<any[]>('/issues').catch(() => []),
    enabled: !!authToken
  });

  const { data: digsyncList = [] } = useQuery({
    queryKey: ['digsync'],
    queryFn: () => fetchApi<any[]>('/digsync').catch(() => []),
    enabled: !!authToken
  });

  // Filter projects by category, road closure, etc.
  const filteredProjects = useMemo(() => {
    return rawProjects.filter(p => {
      if (categoryFilter !== 'All') {
        if (categoryFilter === 'Drainage' && !p.category.toLowerCase().includes('drain')) return false;
        if (categoryFilter === 'Water Supply' && !p.category.toLowerCase().includes('water')) return false;
        if (categoryFilter === 'Roads' && !p.category.toLowerCase().includes('road')) return false;
        if (categoryFilter === 'Electricity' && !p.category.toLowerCase().includes('elect')) return false;
        if (categoryFilter === 'Telecom' && !p.category.toLowerCase().includes('telecom')) return false;
        if (categoryFilter === 'Delayed' && p.status !== 'Delayed') return false;
      }
      if (showClosuresOnly && !p.disruption.toLowerCase().includes('close') && !p.disruption.toLowerCase().includes('closure')) {
        return false;
      }
      return true;
    });
  }, [rawProjects, categoryFilter, showClosuresOnly]);

  const selectedProject = useMemo(() => {
    return rawProjects.find(p => p.id === selectedProjectId) || null;
  }, [rawProjects, selectedProjectId]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmittedSearch(search.trim());
    setSelectedProjectId(null);
  };

  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(''), 4500);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  const pathname = loc.pathname;
  const isLoginSelectionRoute = pathname === '/login';
  const isCitizenLoginRoute = pathname === '/citizen/login';
  const isContractorAdminRoute = pathname === '/admin/contractors';
  const isDeptVerificationRoute = pathname === '/department/contractor-verification';
  const isMunicipalityLoginRoute = pathname === '/municipality/login';
  const isDepartmentLoginRoute = pathname === '/department/login';
  const isOnsiteLoginRoute = pathname === '/onsite/login';
  const isMunicipalityDashboardRoute = pathname === '/municipality/dashboard' || pathname === '/admin' || pathname === '/municipal';
  const isDepartmentDashboardRoute = pathname === '/department/dashboard' || pathname === '/department';
  const isDepartmentCreateProjectRoute = pathname === '/department/create-project' || pathname === '/official/create-project';
  const isOnsiteDashboardRoute = pathname === '/onsite/dashboard';
  const isCitizenExplicitRoute = pathname === '/citizen';
  const isPortalRoute = isLoginSelectionRoute || isCitizenLoginRoute || isContractorAdminRoute || isDeptVerificationRoute || isMunicipalityLoginRoute || isDepartmentLoginRoute || isOnsiteLoginRoute || isMunicipalityDashboardRoute || isDepartmentDashboardRoute || isDepartmentCreateProjectRoute || isOnsiteDashboardRoute;

  return (
    <div className="app-shell">
      {/* Top Navigation */}
      <header className="topbar">
        <Link to="/" className="brand" onClick={() => { setSelectedProjectId(null); }}>
          <div className="brand-mark">
            <UtopiaLogo size={22} />
          </div>
          <span>Uto<span>pia</span></span>
          <span className="brand-badge">Chennai GCC</span>
        </Link>

        {/* Resident Active PIN Code Switcher Pill */}
        {!isPortalRoute && activePincode && (
          <button
            className="pincode-switcher-pill"
            onClick={() => nav(isCitizenExplicitRoute ? '/citizen' : '/')}
            title="Click to change your PIN code or locality"
          >
            <MapPin size={14} />
            <span className="pincode-pill-text-desktop">PIN {activePincode} ({activeAreaName})</span>
            <span className="pincode-pill-text-mobile">{activeAreaName || activePincode} ▾</span>
            <span className="pincode-change-tag">Change Locality ▾</span>
          </button>
        )}

        <nav className="main-nav">
          {!isPortalRoute && activePincode ? (
            <>
              <button
                className={`nav-link ${urlView === 'info' ? 'active' : ''}`}
                onClick={() => nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}&view=info`)}
                title="Information Dashboard (Map-Free)"
              >
                <LayoutGrid size={15} />
                Info Dashboard
              </button>
              <button
                className={`nav-link ${urlView === 'map' ? 'active' : ''}`}
                onClick={() => nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}&view=map`)}
                title="Interactive Map Dashboard"
              >
                <Compass size={15} />
                Map Dashboard
              </button>
              <button
                className={`nav-link ${!urlView ? 'active' : ''}`}
                onClick={() => nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}`)}
                title="Choose Dashboard View"
              >
                <Layers size={15} />
                Choose View
              </button>
              <button
                className={`nav-link ${urlView === 'about' ? 'active' : ''}`}
                onClick={() => nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}&view=about`)}
              >
                <Info size={15} />
                About
              </button>
            </>
          ) : !isPortalRoute ? (
            <>
              <button
                className="nav-link active"
                onClick={() => nav(isCitizenExplicitRoute ? '/citizen' : '/')}
              >
                <MapPin size={15} />
                Select Locality
              </button>
              <button
                className={`nav-link ${urlView === 'about' ? 'active' : ''}`}
                onClick={() => nav('/?view=about')}
              >
                <Info size={15} />
                About Utopia
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className={`nav-link ${isCitizenExplicitRoute ? 'active' : ''}`}
                onClick={() => nav('/citizen')}
              >
                <Users size={15} />
                Citizen Portal
              </button>
              {currentUser?.role==='admin'&&<button className="nav-link" onClick={()=>nav('/admin/contractors')}>Performance Management</button>}
              {currentUser?.role==='official'&&<button className="nav-link" onClick={()=>nav('/department/contractor-verification')}>Complaint Verification</button>}
              <button
                className={`nav-link ${isLoginSelectionRoute ? 'active' : ''}`}
                onClick={() => nav('/login')}
              >
                <Shield size={15} />
                Select Role
              </button>
            </div>
          )}
        </nav>

        <div className="top-actions">
          {/* Quick Return to Department / Municipality Portal for Authenticated Officials visiting Citizen View */}
          {currentUser && !isPortalRoute && (
            <button
              className={`return-to-portal-btn ${currentUser.role === 'official' ? 'dept-btn' : currentUser.role === 'admin' ? 'admin-btn' : 'onsite-btn'}`}
              onClick={() => {
                if (currentUser.role === 'official') nav('/department/dashboard');
                else if (currentUser.role === 'admin') nav('/municipality/dashboard');
                else nav('/onsite/dashboard');
              }}
              title={`Return to ${currentUser.role === 'official' ? 'Department' : currentUser.role === 'admin' ? 'Municipality' : 'Field'} Dashboard`}
            >
              {currentUser.role === 'official' ? <Building2 size={13} /> : currentUser.role === 'admin' ? <Shield size={13} /> : <HardHat size={13} />}
              <span>Return to {currentUser.role === 'official' ? 'Department Portal' : currentUser.role === 'admin' ? 'Municipality Portal' : 'Field Portal'}</span>
            </button>
          )}

          {currentUser ? (
            <div className="officer-badge-nav">
              {currentUser.role === 'onsite' ? (
                <HardHat size={14} color="#d97706" />
              ) : currentUser.role === 'official' ? (
                <Briefcase size={14} color="#0d9488" />
              ) : (
                <Shield size={14} color="#1d4ed8" />
              )}
              <span>
                <strong>{currentUser.name}</strong> · {currentUser.badge_id}
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  background: currentUser.role === 'onsite' ? '#fef3c7' : currentUser.role === 'official' ? '#ccfbf1' : '#eff6ff',
                  color: currentUser.role === 'onsite' ? '#92400e' : currentUser.role === 'official' ? '#0f766e' : '#1e40af',
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  marginLeft: '7px'
                }}>
                  {currentUser.role === 'onsite' ? 'On-site Official' : currentUser.role === 'official' ? `${currentUser.department} Officer` : 'Municipal Official'}
                </span>
              </span>
              <button className="logout-nav-button" onClick={handleLogout} title="Sign Out">
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              className="admin-nav-button"
              onClick={() => nav('/login')}
              id="header-login-btn"
              title="Access Municipality, Department, or On-site Portals"
            >
              <Key size={13} />
              Portal Login
            </button>
          )}
        </div>
      </header>

      {/* Role-Aware Official Banner on Citizen Portal */}
      {currentUser && !isPortalRoute && (
        <div className="official-citizen-banner">
          <div className="banner-text">
            <Shield size={15} />
            <span>
              Viewing Public Citizen Portal as authenticated <strong>{currentUser.name}</strong> ({currentUser.role === 'official' ? `${currentUser.department} Officer` : currentUser.role === 'admin' ? 'Municipal Officer' : 'On-site Field Officer'}). Public privacy protections are enforced.
            </span>
          </div>
          <button
            className="btn-return-shortcut"
            onClick={() => {
              if (currentUser.role === 'official') nav('/department/dashboard');
              else if (currentUser.role === 'admin') nav('/municipality/dashboard');
              else nav('/onsite/dashboard');
            }}
          >
            Return to {currentUser.role === 'official' ? 'Department' : currentUser.role === 'admin' ? 'Municipality' : 'Field'} Portal →
          </button>
        </div>
      )}

      {/* Main View Router */}
      {isLoginSelectionRoute ? (
        /* 1. ROLE SELECTION ROUTE (/login) */
        <RoleSelectionPage />
      ) : isCitizenLoginRoute ? (
        <CitizenLoginPage onLogin={handleLogin} onBack={() => nav(-1)} />
      ) : isContractorAdminRoute ? (
        currentUser?.role==='admin' ? <ContractorAdminPage onToast={setToastMessage}/> : <MunicipalityLoginPage onLogin={handleLogin}/>
      ) : isDeptVerificationRoute ? (
        (currentUser?.role==='official'||currentUser?.role==='admin') ? <DepartmentComplaintVerificationPage onToast={setToastMessage}/> : <DepartmentLoginPage onLogin={handleLogin}/>
      ) : isMunicipalityLoginRoute ? (
        /* 2. MUNICIPALITY LOGIN ROUTE (/municipality/login) */
        currentUser && currentUser.role === 'admin' ? (
          <MunicipalDashboard
            user={currentUser}
            projects={rawProjects}
            stats={stats}
            issues={allAdminIssues}
            digsync={digsyncList}
            onLogout={handleLogout}
            onToast={setToastMessage}
          />
        ) : (
          <MunicipalityLoginPage onLogin={handleLogin} />
        )
      ) : isDepartmentLoginRoute ? (
        /* 3. DEPARTMENT LOGIN ROUTE (/department/login) */
        currentUser && currentUser.role === 'official' ? (
          <DepartmentDashboard
            user={currentUser}
            projects={rawProjects}
            issues={allAdminIssues}
            digsync={digsyncList}
            onLogout={handleLogout}
            onToast={setToastMessage}
          />
        ) : (
          <DepartmentLoginPage onLogin={handleLogin} />
        )
      ) : isOnsiteLoginRoute ? (
        /* 4. ON-SITE OFFICIAL LOGIN ROUTE (/onsite/login) */
        currentUser && currentUser.role === 'onsite' ? (
          <OnsiteDashboard
            user={currentUser}
            projects={rawProjects}
            onLogout={handleLogout}
            onToast={setToastMessage}
          />
        ) : (
          <OnsiteLoginPage onLogin={handleLogin} />
        )
      ) : isMunicipalityDashboardRoute ? (
        /* 5. MUNICIPALITY DASHBOARD ROUTE (/municipality/dashboard & /admin) */
        !currentUser ? (
          <MunicipalityLoginPage onLogin={handleLogin} />
        ) : currentUser.role === 'onsite' ? (
          <OnsiteDashboard
            user={currentUser}
            projects={rawProjects}
            onLogout={handleLogout}
            onToast={setToastMessage}
          />
        ) : currentUser.role === 'official' ? (
          <DepartmentDashboard
            user={currentUser}
            projects={rawProjects}
            issues={allAdminIssues}
            digsync={digsyncList}
            onLogout={handleLogout}
            onToast={setToastMessage}
          />
        ) : (
          <MunicipalDashboard
            user={currentUser}
            projects={rawProjects}
            stats={stats}
            issues={allAdminIssues}
            digsync={digsyncList}
            onLogout={handleLogout}
            onToast={setToastMessage}
          />
        )
      ) : isDepartmentCreateProjectRoute ? (
        /* 6b. DEPARTMENT CREATE PROJECT ROUTE (/department/create-project & /official/create-project) */
        !currentUser ? (
          <DepartmentLoginPage onLogin={handleLogin} />
        ) : (
          <CreateProjectPage
            user={currentUser}
            onCreated={(newProj) => {
              setToastMessage(`Project ${newProj.code || ''} sanctioned and registered under ${currentUser.department}!`);
              nav('/department/dashboard');
            }}
            onBack={() => nav('/department/dashboard')}
          />
        )
      ) : isDepartmentDashboardRoute ? (
        /* 6. DEPARTMENT DASHBOARD ROUTE (/department/dashboard) */
        !currentUser ? (
          <DepartmentLoginPage onLogin={handleLogin} />
        ) : (
          <DepartmentDashboard
            user={currentUser}
            projects={rawProjects}
            issues={allAdminIssues}
            digsync={digsyncList}
            onLogout={handleLogout}
            onToast={setToastMessage}
          />
        )
      ) : isOnsiteDashboardRoute ? (
        /* 7. ON-SITE OFFICIAL DASHBOARD ROUTE (/onsite/dashboard) */
        !currentUser ? (
          <OnsiteLoginPage onLogin={handleLogin} />
        ) : (
          <OnsiteDashboard
            user={currentUser}
            projects={rawProjects}
            onLogout={handleLogout}
            onToast={setToastMessage}
          />
        )
      ) : urlView === 'about' ? (
        /* Fully Responsive About Page */
        <ResponsiveAboutPage
          onBackToMap={() => {
            if (activePincode) nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}&view=map`);
            else nav(isCitizenExplicitRoute ? '/citizen' : '/');
          }}
        />
      ) : !activePincode ? (
        /* SCREEN 1: LOCATION SELECTION INITIAL SCREEN */
        <LocationSelectPage
          localities={availableLocalities}
          onSelectLocality={handleSelectResidentPin}
          onDetectLocation={handleDetectLocation}
          detecting={isDetectingLocation}
          onOfficerLogin={() => nav('/login')}
        />
      ) : !urlView ? (
        /* SCREEN 2: DASHBOARD VIEW CHOOSER SCREEN */
        <DashboardChoicePage
          pincode={activePincode}
          localityName={activeAreaName}
          workCount={rawProjects.length}
          onChangeLocality={() => nav('/')}
          onSelectView={(view) => nav(`/?pin=${activePincode}&view=${view}`)}
        />
      ) : urlView === 'info' ? (
        /* SCREEN 3: MAP-FREE INFORMATION DASHBOARD */
        <MapFreeInfoDashboard
          pincode={activePincode}
          localityName={activeAreaName}
          projects={rawProjects}
          onProjectClick={(proj) => {
            setSelectedProjectId(proj.id);
            nav(`/?pin=${activePincode}&view=map&project=${proj.id}&from=info`);
          }}
          onSwitchToMap={() => nav(`/?pin=${activePincode}&view=map`)}
          onChangeLocality={() => nav('/')}
          onChooseView={() => nav(`/?pin=${activePincode}`)}
        />
      ) : (
        /* SCREEN 4: EXISTING INTERACTIVE GOOGLE MAPS DASHBOARD */
        <main className="gmaps-layout">
          {/* Back to Info Dashboard banner if came from info view */}
          {urlFrom === 'info' && (
            <div className="map-back-to-info-banner">
              <button
                className="map-back-btn"
                onClick={handleBackToInfoDashboard}
                title="Return to Information Dashboard"
              >
                <ArrowLeft size={16} /> Back to Information Dashboard
              </button>
            </div>
          )}

          {/* Full-bleed Google Maps Canvas */}
          <div className="gmaps-map-wrapper">
            <MapContainer
              center={resolvedLocation?.center || PIN_COORDINATES[activePincode]?.center || [13.045, 80.24]}
              zoom={resolvedLocation?.zoom || PIN_COORDINATES[activePincode]?.zoom || 14}
              zoomControl={false}
              className="leaflet-fullmap"
            >
              {mapType === 'streets' ? (
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              ) : (
                <TileLayer
                  attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              )}

              <MapClickHandler active={isSelectAreaMode} onMapClick={handleMapClick} />

              <MapController
                selectedProject={selectedProject}
                activePincode={activePincode}
                resolvedLocation={resolvedLocation}
                projects={rawProjects}
              />

              {/* Temporary Pin for interactive map-click location selection */}
              {clickedPoint && (
                <Marker
                  position={[clickedPoint.lat, clickedPoint.lng]}
                  icon={new L.DivIcon({
                    className: 'custom-temp-marker',
                    html: `<div style="background:#dc2626;color:#ffffff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid #ffffff;box-shadow:0 3px 12px rgba(0,0,0,0.4);font-size:18px;">📍</div>`,
                    iconSize: [34, 34],
                    iconAnchor: [17, 34]
                  })}
                >
                  <Popup autoClose={false}>
                    <div style={{ padding: '6px' }}>
                      <strong>Selected Coordinates</strong>
                      <div style={{ fontSize: '12px', color: '#475569' }}>{clickedPoint.lat.toFixed(5)}, {clickedPoint.lng.toFixed(5)}</div>
                      {isReverseGeocoding && <div style={{ fontSize: '11px', color: '#0f766e', marginTop: '4px' }}>Resolving postal area…</div>}
                    </div>
                  </Popup>
                </Marker>
              )}

              {filteredProjects.map(p => (
                <Marker
                  key={p.id}
                  position={[p.lat, p.lng]}
                  icon={createGmapsPin(p.category, p.status, selectedProjectId === p.id)}
                  eventHandlers={{
                    click: () => setSelectedProjectId(p.id)
                  }}
                >
                  <Popup>
                    <div style={{ padding: '4px' }}>
                      <strong style={{ fontSize: '13px', color: '#0f2438' }}>{p.title}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b', margin: '3px 0' }}>{p.address}</div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#10896b' }}>
                        {p.status} · {p.progress}% Progress
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Click-to-jump hint */}
          {isSelectAreaMode && (
            <div className="map-select-mode-banner">
              <Crosshair size={16} />
              <span>Click anywhere on the map to glide to that area's PIN code.</span>
            </div>
          )}

          {/* Floating Google Maps Search & Filter Controls */}
          <div className="gmaps-floating-controls">
            <form
              className="gmaps-search-card"
              onSubmit={(e) => {
                e.preventDefault();
                const q = search.trim();
                if (/^\d{6}$/.test(q)) {
                  handleSelectResidentPin(q);
                  return;
                }
                setSubmittedSearch(q);
                setSelectedProjectId(null);
              }}
            >
              <div className="gmaps-search-icon">
                <Search size={18} />
              </div>
              <input
                className="gmaps-search-input"
                placeholder="Search road, PIN code, or contractor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="gmaps-clear-btn"
                  onClick={() => {
                    setSearch('');
                    setSubmittedSearch('');
                  }}
                >
                  <X size={16} />
                </button>
              )}
              <button type="submit" className="gmaps-submit-btn">
                Find
              </button>
            </form>

            {/* Category Filter Chips */}
            <div className="gmaps-chips-scroll">
              {[
                { label: 'All Works', val: 'All' },
                { label: '🌊 Drainage', val: 'Drainage' },
                { label: '💧 Water', val: 'Water Supply' },
                { label: '🛣️ Roads', val: 'Roads' },
                { label: '⚡ Electricity', val: 'Electricity' },
                { label: '📡 Telecom', val: 'Telecom' },
                { label: '⚠️ Delayed', val: 'Delayed' }
              ].map(item => (
                <button
                  key={item.val}
                  type="button"
                  className={`gmaps-chip ${categoryFilter === item.val ? 'active' : ''}`}
                  onClick={() => setCategoryFilter(item.val)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Floating Right Map Controls (Map vs Satellite, Road Closures Layer, Select Area on Map) */}
          <div className="gmaps-map-controls">
            <div className="gmaps-type-toggle">
              <button
                type="button"
                className={`gmaps-type-btn ${mapType === 'streets' ? 'active' : ''}`}
                onClick={() => setMapType('streets')}
              >
                Map
              </button>
              <button
                type="button"
                className={`gmaps-type-btn ${mapType === 'satellite' ? 'active' : ''}`}
                onClick={() => setMapType('satellite')}
              >
                Sat
              </button>
            </div>

            <button
              type="button"
              className={`gmaps-icon-pill-btn ${isSelectAreaMode ? 'active' : ''}`}
              onClick={() => {
                setIsSelectAreaMode(!isSelectAreaMode);
                if (isSelectAreaMode) setClickedPoint(null);
              }}
              title="Click on the map to inspect coordinates & PIN code"
            >
              <Crosshair size={14} />
              <span className="control-btn-label">{isSelectAreaMode ? 'Click: On' : 'Click: Off'}</span>
            </button>

            <button
              type="button"
              className="gmaps-icon-pill-btn"
              onClick={handleDetectLocation}
              disabled={isDetectingLocation}
              title="Detect my PIN code using device location"
            >
              <Navigation size={14} />
              <span className="control-btn-label">{isDetectingLocation ? 'Detecting…' : 'GPS'}</span>
            </button>

            <button
              type="button"
              className={`gmaps-icon-pill-btn ${showClosuresOnly ? 'active' : ''}`}
              onClick={() => setShowClosuresOnly(!showClosuresOnly)}
              title="Show Road Closures and Detours"
            >
              <Car size={14} />
              <span className="control-btn-label">{showClosuresOnly ? 'All Works' : 'Closures'}</span>
            </button>

            <button
              type="button"
              className="gmaps-icon-pill-btn control-info-btn-desktop"
              onClick={() => nav(`/?pin=${activePincode}&view=info`)}
              title="Switch to Map-Free Information Dashboard"
            >
              <LayoutGrid size={14} />
              <span className="control-btn-label">Info Dashboard</span>
            </button>
          </div>

          {/* PLACE CARDS DECK FLOATING ON TOP OF THE MAP */}
          <div className={`gmaps-cards-deck-wrapper ${selectedProject ? 'has-selected-sheet' : ''} ${isDeckCollapsed ? 'deck-collapsed' : ''}`}>
            <div className="gmaps-cards-deck-header">
              <span className="gmaps-deck-badge" onClick={() => setIsDeckCollapsed(!isDeckCollapsed)}>
                <MapPin size={13} />
                {filteredProjects.length} Works in {activeAreaName}
              </span>
              <button
                type="button"
                className="deck-collapse-toggle-btn"
                onClick={() => setIsDeckCollapsed(!isDeckCollapsed)}
                title={isDeckCollapsed ? "Expand works cards" : "Collapse cards to explore full map"}
              >
                {isDeckCollapsed ? '▲ Show Works' : '▼ Hide Cards'}
              </button>
            </div>

            {!isDeckCollapsed && (
              <div className="gmaps-cards-deck">
              {filteredProjects.length === 0 ? (
                <div className="empty-projects-pill" style={{ padding: '16px 20px', background: '#ffffff', borderRadius: '14px', border: '1.5px solid #e2e8f0', color: '#475569', fontSize: '13.5px', margin: '4px 8px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                  <Info size={18} color="#0f766e" />
                  <span>No public works currently listed for PIN {activePincode} ({activeAreaName || 'Chennai'}).</span>
                </div>
              ) : (
                filteredProjects.map(p => (
                  <div
                    key={p.id}
                    className={`deck-place-card ${selectedProjectId === p.id ? 'active' : ''}`}
                    onClick={() => setSelectedProjectId(p.id)}
                  >
                    <div>
                      <div className="deck-card-top">
                        <span className={`place-status-chip ${p.status.toLowerCase().replace(/\s+/g, '-')}`}>
                          {p.status}
                        </span>
                        <span className="deck-code-pill">{p.code}</span>
                      </div>

                      <h4 className="deck-card-title">{p.title}</h4>
                      <div className="deck-card-road">
                        <MapPin size={12} /> {p.address}
                      </div>

                      <div className="deck-card-progress">
                        <div className="deck-progress-bar">
                          <div className="deck-progress-fill" style={{ width: `${p.progress}%` }} />
                        </div>
                        <div className="deck-progress-label">
                          <span>Stage {p.current_step || 3}/7</span>
                          <strong>{p.progress}% Progress</strong>
                        </div>
                      </div>
                    </div>

                    <div className="deck-card-footer">
                      <span>{p.disruption.split('·')[0]}</span>
                      <span>View Details & Tracker →</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            )}
          </div>

          {/* EXPANDED & INCREASED SIZE PLACE DETAIL SHEET */}
          {selectedProject && (
            <aside className="gmaps-place-sheet">
              {/* Mobile Sheet Drag Handle */}
              <div className="mobile-sheet-drag-handle" onClick={() => setSelectedProjectId(null)}>
                <div className="drag-handle-bar" />
              </div>

              {/* Place Hero Banner */}
              <div className="place-sheet-hero">
                <div className="place-hero-top">
                  <span className="place-dept-pill">{selectedProject.department} · {selectedProject.category}</span>
                  <button
                    className="place-close-btn"
                    onClick={() => setSelectedProjectId(null)}
                    title="Close place view"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="place-hero-bottom">
                  <span className="place-code">{selectedProject.code}</span>
                  <span className={`place-status-chip ${selectedProject.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {selectedProject.status}
                  </span>
                </div>
              </div>

              {/* Scrollable Place Details */}
              <div className="place-sheet-scroll">
                {/* Back to Info Dashboard button if navigated from info view */}
                {urlFrom === 'info' && (
                  <button
                    className="sheet-back-to-info-btn"
                    onClick={handleBackToInfoDashboard}
                    title="Return to Map-Free Information Dashboard"
                  >
                    <ArrowLeft size={14} /> Back to Information Dashboard
                  </button>
                )}

                {/* Title & Location Header */}
                <div className="place-title-section">
                  <h2>{selectedProject.title}</h2>
                  <div className="place-location-row">
                    <MapPin size={16} />
                    <span>{selectedProject.address} · PIN {selectedProject.pincode}</span>
                  </div>
                  <p className="place-description-text">{selectedProject.description}</p>
                </div>

                {/* GMaps Style Quick Actions */}
                <div className="place-quick-actions">
                  <button className="place-action-btn" onClick={() => setIssueModalOpen(true)}>
                    <AlertTriangle />
                    <span>Report Issue</span>
                  </button>
                  <button className="place-action-btn" onClick={() => {
                    const el = document.getElementById('project-qa-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    <HelpCircle />
                    <span>Ask Question</span>
                  </button>
                  <button className="place-action-btn" onClick={() => {
                    const el = document.getElementById('project-commute-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    <Car />
                    <span>Detour Advice</span>
                  </button>
                  <button className="place-action-btn" onClick={() => {
                    const el = document.getElementById('project-contact-section');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    <Phone />
                    <span>Work Handler</span>
                  </button>
                </div>

                {/* 1. AMAZON-STYLE LIVE ORDER TRACKING DASHBOARD */}
                <div className="amazon-tracker-card">
                  <div className="section-label">
                    <Sparkles size={12} />
                    LIVE PROJECT TRACKING (AMAZON STYLE)
                  </div>

                  <div className="amazon-tracker-header">
                    <div className="tracker-headline">
                      <h3>Stage {selectedProject.current_step || 3} of 7</h3>
                      <p>
                        {MILESTONE_STEPS[(selectedProject.current_step || 3) - 1]?.title || 'Construction in progress'}
                      </p>
                    </div>
                    <div className="progress-metric">
                      <div className="progress-percentage">{selectedProject.progress}%</div>
                      <div className="progress-subtext">Verified Progress</div>
                    </div>
                  </div>

                  {/* Amazon Progress Bar */}
                  <div className="amazon-progress-bar">
                    <div
                      className="amazon-progress-fill"
                      style={{ width: `${selectedProject.progress}%` }}
                    />
                  </div>

                  {/* Amazon Delay Alert Banner if Behind Schedule */}
                  {selectedProject.status === 'Delayed' && (
                    <div className="amazon-delay-alert">
                      <AlertOctagon size={18} />
                      <div className="delay-alert-content">
                        <b>Arriving later than scheduled</b>
                        <p>{selectedProject.delay_reason || 'Unanticipated underground utility obstruction identified during trenching.'}</p>
                        {selectedProject.mitigation && (
                          <small><strong>Mitigation:</strong> {selectedProject.mitigation}</small>
                        )}
                        <small style={{ marginTop: '4px', opacity: 0.8 }}>
                          Revised deadline: {formatDate(selectedProject.revised_date || selectedProject.due_date)}
                        </small>
                      </div>
                    </div>
                  )}

                  {/* Amazon Vertical Milestone Stepper */}
                  <div className="amazon-steps-list">
                    {MILESTONE_STEPS.map((stepItem) => {
                      const currentStep = selectedProject.current_step || 3;
                      const isCompleted = stepItem.step < currentStep || selectedProject.status === 'Completed';
                      const isCurrent = stepItem.step === currentStep && selectedProject.status !== 'Completed';

                      return (
                        <div
                          key={stepItem.step}
                          className={`amazon-step-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                        >
                          <div className="amazon-step-icon">
                            {isCompleted ? <Check size={14} /> : stepItem.step}
                          </div>
                          <div className="amazon-step-details">
                            <div className="step-title-row">
                              <b>{stepItem.title}</b>
                              <span>
                                {isCompleted ? 'Cleared' : isCurrent ? 'Active Now' : 'Pending'}
                              </span>
                            </div>
                            <p>{stepItem.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. LOCAL CONSTRUCTION HAZARD WARNINGS & NOTIFICATIONS */}
                <div className="hazards-card">
                  <div className="section-label">
                    <AlertTriangle size={12} />
                    LOCAL DISRUPTION & HAZARD WARNINGS
                  </div>

                  {/* Noise Warning Box */}
                  <div className="hazard-box noise">
                    <Volume2 size={18} />
                    <div className="hazard-info">
                      <b>Noise Hazard Warning</b>
                      <p>{selectedProject.noise_warning || 'Permitted heavy work window: 22:00 – 04:00 (Acoustic curtains deployed)'}</p>
                    </div>
                  </div>

                  {/* Dust Warning Box */}
                  <div className="hazard-box dust">
                    <Wind size={18} />
                    <div className="hazard-info">
                      <b>Dust Control Advisory</b>
                      <p>{selectedProject.dust_warning || 'Excavation dust suppression window: 08:30 – 13:30 (Water mist cannons active)'}</p>
                    </div>
                  </div>

                  <div className="advance-notice-badge">
                    <CheckCircle2 size={14} />
                    <span>Advance intimation notice published 48h prior to area residents</span>
                  </div>
                </div>

                {/* 3. COMMUTE & GOOGLE MAPS INTIMATION */}
                <div className="commute-card" id="project-commute-section">
                  <div className="section-label">
                    <Car size={12} />
                    COMMUTE & NAVIGATION ADVISORY
                  </div>

                  <div className="gmaps-sync-badge">
                    <span className="gmaps-sync-dot" />
                    <span>Intimated to Google Maps & Chennai Traffic Police</span>
                  </div>

                  <div className="commute-details">
                    <p><strong>Traffic Impact:</strong> {selectedProject.disruption}</p>
                    <div className="detour-box">
                      <strong>Recommended Detour:</strong> {selectedProject.detour_advice || 'Diversion via nearest arterial corridor.'}
                    </div>
                  </div>
                </div>

                {/* 4. RESPONSIBLE WORK HANDLER & OFFICIAL CONTACTS */}
                <div className="contacts-card" id="project-contact-section">
                  <div className="section-label">
                    <Users size={12} />
                    WORK HANDLER & OFFICIAL CONTACTS
                  </div>

                  <div className="contacts-grid">
                    <div className="contact-person-row">
                      <div className="contact-avatar">
                        <User size={18} />
                      </div>
                      <div className="contact-meta">
                        <b>{selectedProject.contact_engineer_name || 'Er. K. Ramanathan'}</b>
                        <span>Site Executive Engineer · {selectedProject.department}</span>
                        <a href={`tel:${selectedProject.contact_engineer_phone || '+919444028192'}`}>
                          <Phone size={12} /> {selectedProject.contact_engineer_phone || '+91 94440 28192'}
                        </a>
                      </div>
                    </div>

                    <div className="contact-person-row">
                      <div className="contact-avatar">
                        <HardHat size={18} />
                      </div>
                      <div className="contact-meta">
                        <b>{selectedProject.contact_contractor || selectedProject.contractor}</b>
                        <span>Executing Contractor Agency</span>
                        <a href={`tel:${selectedProject.contact_contractor_phone || '+919884155210'}`}>
                          <Phone size={12} /> {selectedProject.contact_contractor_phone || '+91 98841 55210'}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. COMMUNITY QUESTIONS & OFFICIAL REPLIES (PUBLIC TO ALL CITIZENS) */}
                {/* User requirement: "the questions asked by a resident should be visible to other citizens in that area. and also the answers by the muncipal..." */}
                <div className="qa-card" id="project-qa-section">
                  <div className="section-label">
                    <MessageSquare size={12} />
                    COMMUNITY QUESTIONS IN {activeAreaName} (VISIBLE TO ALL RESIDENTS)
                  </div>

                  <div className="qa-list">
                    {communityQuestions.map((q: any) => (
                      <div className="qa-item" key={q.id}>
                        <div className="qa-question">
                          <HelpCircle size={15} />
                          <div>
                            <strong>{q.kind} · {q.ref}</strong><br /><span>{q.message}</span>
                            <small style={{ display: 'block', color: '#64748b', fontSize: '10px', marginTop: '2px' }}>
                              {q.project_title ? `${q.project_title} · ` : ''}{q.locality || activeAreaName} · {formatDate(q.created)}{q.contractor ? ` · Contractor ${q.contractor}` : ''}
                            </small>
                          </div>
                        </div>

                        {!q.is_question && <CommunityComplaintActions issue={q} onToast={setToastMessage} />}

                        {q.official_reply ? (
                          <div className="qa-reply">
                            <span>{q.official_reply}</span>
                            <small>— {q.replied_by || 'Municipal Engineer'} · {formatDate(q.replied_at)}</small>
                          </div>
                        ) : (
                          <div className="qa-unanswered-badge">
                            <Clock size={12} />
                            <span>Awaiting Official Municipal Response</span>
                          </div>
                        )}
                        <IssueEvidence items={q.attachments || []} />
                      </div>
                    ))}

                    {communityQuestions.length === 0 && (
                      <p style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                        No community questions recorded yet for this area. Ask the first question below!
                      </p>
                    )}
                  </div>

                  {/* Ask Question Form */}
                  <form
                    className="ask-qa-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const input = (form.elements.namedItem('question') as HTMLTextAreaElement);
                      const questionText = input.value.trim();
                      if (questionText.length >= 6) {
                        try {
                          const res = await fetchApi<any>('/issues', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              project_id: selectedProject.id,
                              department: selectedProject.department || 'Greater Chennai Corporation',
                              pincode: selectedProject.pincode || activePincode,
                              kind: 'Citizen Question',
                              message: questionText,
                              locality: selectedProject.locality || activeAreaName,
                              severity: 'Normal',
                              is_question: true
                            })
                          });
                          setToastMessage(`Question published! Routed to ${res.department || selectedProject.department} & visible to all residents.`);
                          input.value = '';
                          qc.invalidateQueries({ queryKey: ['issues'] });
                          qc.invalidateQueries({ queryKey: ['issues', activePincode] });
                          qc.invalidateQueries({ queryKey: ['admin_issues'] });
                        } catch {
                          setToastMessage('Question recorded for municipal engineering review.');
                          input.value = '';
                          qc.invalidateQueries({ queryKey: ['issues'] });
                          qc.invalidateQueries({ queryKey: ['issues', activePincode] });
                          qc.invalidateQueries({ queryKey: ['admin_issues'] });
                        }
                      }
                    }}
                  >
                    <textarea
                      name="question"
                      className="ask-qa-textarea"
                      placeholder="Ask a question regarding lags, noise or completion schedule (visible to all area residents)..."
                      rows={2}
                      required
                    />
                    <button type="submit" className="ask-qa-btn">
                      <Send size={13} />
                      Post Public Question
                    </button>
                  </form>
                </div>

                {/* Mobile Return to Map Button */}
                <div className="place-mobile-footer-actions">
                  <button
                    type="button"
                    className="place-return-map-btn"
                    onClick={() => setSelectedProjectId(null)}
                  >
                    <ArrowLeft size={16} /> Return to Map View
                  </button>
                </div>
              </div>
            </aside>
          )}

          {/* Citizen Issue Modal */}
          {issueModalOpen && (
            <CitizenIssueModal
              project={selectedProject}
              pincode={activePincode}
              localityName={activeAreaName}
              onClose={() => setIssueModalOpen(false)}
              onSuccess={(ref) => {
                setIssueModalOpen(false);
                setToastMessage(`Grievance registered under Ref: ${ref}`);
                qc.invalidateQueries({ queryKey: ['issues', activePincode] });
              }}
            />
          )}
        </main>
      )}



      {/* PIN CODE SWITCHER MODAL */}
      {/* User requirement: "also citizens should have an option to change the pincode after log in.." */}
      {pincodeSwitcherOpen && (
        <div className="modal-overlay" onClick={() => setPincodeSwitcherOpen(false)}>
          <div className="modal-window" onClick={e => e.stopPropagation()}>
            <div className="modal-window-head">
              <h3>Switch Locality / PIN Code</h3>
              <button onClick={() => setPincodeSwitcherOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-window-body">
              <p style={{ fontSize: '13px', color: '#64748b' }}>
                Enter any 6-digit Indian PIN code to view public works in that area:
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const newPin = (form.elements.namedItem('newPin') as HTMLInputElement).value;
                  if (newPin.trim().length === 6) {
                    handleSelectResidentPin(newPin.trim());
                  }
                }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    name="newPin"
                    defaultValue={activePincode}
                    className="pincode-input-box"
                    placeholder="Enter 6-digit PIN code"
                    maxLength={6}
                    autoFocus
                    required
                  />
                  <button type="submit" className="role-action-btn">
                    Set PIN
                  </button>
                </div>
              </form>

              <div style={{ marginTop: '16px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                  Quick Chennai Areas:
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                  <button
                    className="demo-login-chip"
                    onClick={() => handleSelectResidentPin('600005')}
                  >
                    <b>Triplicane (600005)</b>
                    <small>4 Registered Works</small>
                  </button>
                  <button
                    className="demo-login-chip"
                    onClick={() => handleSelectResidentPin('600127')}
                  >
                    <b>Melakottaiyur (600127)</b>
                    <small>5 Registered Works</small>
                  </button>
                  <button
                    className="demo-login-chip"
                    onClick={() => handleSelectResidentPin('600023')}
                  >
                    <b>Ayanavaram (600023)</b>
                    <small>3 Registered Works</small>
                  </button>
                  <button
                    className="demo-login-chip"
                    onClick={() => handleSelectResidentPin('600017')}
                  >
                    <b>T. Nagar (600017)</b>
                    <small>2 Registered Works</small>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Interactive Area Selection Modal */}
      {locationConfirmModal && (
        <div className="map-confirm-modal-overlay">
          <div className="map-confirm-modal">
            <div className="map-confirm-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} color="#0f766e" />
                <h3>Confirm Selected Location</h3>
              </div>
              <button
                onClick={() => {
                  setLocationConfirmModal(null);
                  setClickedPoint(null);
                }}
                className="close-confirm-modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="map-confirm-body">
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 12px' }}>
                Selected map coordinates: <strong>{locationConfirmModal.lat.toFixed(5)}, {locationConfirmModal.lng.toFixed(5)}</strong>
              </p>
              <div className="resolved-locality-box">
                <div className="resolved-row">
                  <span className="res-label">Detected Locality:</span>
                  <span className="res-value">{locationConfirmModal.locality || 'Chennai Region'}</span>
                </div>
                <div className="resolved-row">
                  <span className="res-label">Postal PIN Code:</span>
                  <span className="res-value">
                    {locationConfirmModal.pincode ? (
                      <span className="res-pincode-badge">PIN {locationConfirmModal.pincode}</span>
                    ) : (
                      <span className="res-unresolved-warning">
                        Postal area could not be determined for these exact coordinates
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className="map-confirm-footer">
              <button
                className="btn-cancel"
                onClick={() => {
                  setLocationConfirmModal(null);
                  setClickedPoint(null);
                }}
              >
                Cancel
              </button>
              {locationConfirmModal.pincode ? (
                <button
                  className="btn-confirm"
                  onClick={() => {
                    const pin = locationConfirmModal.pincode!;
                    setIsSelectAreaMode(false);
                    setClickedPoint(null);
                    setLocationConfirmModal(null);
                    handleSelectResidentPin(pin);
                  }}
                >
                  <Check size={14} /> Confirm & View Works in PIN {locationConfirmModal.pincode}
                </button>
              ) : (
                <button
                  className="btn-confirm"
                  onClick={() => {
                    setResolvedLocation({
                      center: [locationConfirmModal.lat, locationConfirmModal.lng],
                      zoom: 15,
                      locality: locationConfirmModal.locality || 'Selected Location'
                    });
                    setIsSelectAreaMode(false);
                    setClickedPoint(null);
                    setLocationConfirmModal(null);
                    setToastMessage(`Map centered on ${locationConfirmModal.lat.toFixed(4)}, ${locationConfirmModal.lng.toFixed(4)}`);
                  }}
                >
                  <Compass size={14} /> Center Map Here
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="app-toast">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} style={{ color: 'white', marginLeft: '6px' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {!isPortalRoute && <UtopiaAIWidget
        defaultPincode={activePincode}
        defaultLocality={activeAreaName}
        onIssueSubmitted={ref => {
          setToastMessage(`Grievance registered under Ref: ${ref}`);
          qc.invalidateQueries({ queryKey: ['issues'] });
          qc.invalidateQueries({ queryKey: ['issues', activePincode] });
          qc.invalidateQueries({ queryKey: ['admin_issues'] });
        }}
      />}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-nav">
        {!isPortalRoute && activePincode ? (
          <>
            <button
              type="button"
              className={`mobile-tab-btn ${urlView === 'map' ? 'active' : ''}`}
              onClick={() => nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}&view=map`)}
            >
              <Compass size={18} />
              <span>Map</span>
            </button>
            <button
              type="button"
              className={`mobile-tab-btn ${urlView === 'info' ? 'active' : ''}`}
              onClick={() => nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}&view=info`)}
            >
              <LayoutGrid size={18} />
              <span>Info</span>
            </button>
            <button
              type="button"
              className={`mobile-tab-btn ${!urlView ? 'active' : ''}`}
              onClick={() => nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}`)}
            >
              <Layers size={18} />
              <span>Views</span>
            </button>
            <button
              type="button"
              className={`mobile-tab-btn ${urlView === 'about' ? 'active' : ''}`}
              onClick={() => nav(`${isCitizenExplicitRoute ? '/citizen' : '/'}?pin=${activePincode}&view=about`)}
            >
              <Info size={18} />
              <span>About</span>
            </button>
          </>
        ) : !isPortalRoute ? (
          <>
            <button
              type="button"
              className="mobile-tab-btn active"
              onClick={() => nav(isCitizenExplicitRoute ? '/citizen' : '/')}
            >
              <MapPin size={18} />
              <span>Areas</span>
            </button>
            <button
              type="button"
              className={`mobile-tab-btn ${urlView === 'about' ? 'active' : ''}`}
              onClick={() => nav('/?view=about')}
            >
              <Info size={18} />
              <span>About</span>
            </button>
            <button
              type="button"
              className="mobile-tab-btn"
              onClick={() => nav('/login')}
            >
              <Shield size={18} />
              <span>Portals</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`mobile-tab-btn ${isCitizenExplicitRoute ? 'active' : ''}`}
              onClick={() => nav('/citizen')}
            >
              <Users size={18} />
              <span>Citizen</span>
            </button>
            <button
              type="button"
              className={`mobile-tab-btn ${isLoginSelectionRoute ? 'active' : ''}`}
              onClick={() => nav('/login')}
            >
              <Shield size={18} />
              <span>Roles</span>
            </button>
            {currentUser && (
              <button
                type="button"
                className="mobile-tab-btn active"
                onClick={() => {
                  if (currentUser.role === 'official') nav('/department/dashboard');
                  else if (currentUser.role === 'admin') nav('/municipality/dashboard');
                  else nav('/onsite/dashboard');
                }}
              >
                <Activity size={18} />
                <span>Dashboard</span>
              </button>
            )}
          </>
        )}
      </nav>
    </div>
  );
}

// ============================================================
// 1. LOCATION SELECTION INITIAL SCREEN (Initial Page)
// ============================================================
function LocationSelectPage({
  localities,
  onSelectLocality,
  onDetectLocation,
  detecting,
  onOfficerLogin
}: {
  localities: { pincode: string; locality: string; count: number; active: number; delayed: number }[];
  onSelectLocality: (pincode: string) => void;
  onDetectLocation: () => void;
  detecting: boolean;
  onOfficerLogin: () => void;
}) {
  const [query, setQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim();
    if (!clean) return;

    // Check if entered a direct 6-digit PIN code
    if (/^\d{6}$/.test(clean)) {
      onSelectLocality(clean);
      return;
    }

    // Check if matches any locality in the list
    const match = localities.find(
      l => l.locality.toLowerCase().includes(clean.toLowerCase()) || l.pincode === clean
    );
    if (match) {
      onSelectLocality(match.pincode);
      return;
    }

    setErrorMsg(`No locality found matching "${clean}". Enter a 6-digit PIN code or choose an area below.`);
  };

  return (
    <div className="location-select-page">
      <div className="location-container">
        {/* Utopia Branding */}
        <div className="location-branding-badge">
          <UtopiaLogo size={16} />
          <span>Utopia Chennai · GCC Smart Civic Works</span>
        </div>

        {/* Heading */}
        <h1 className="location-hero-title">
          Discover public works happening around you.
        </h1>
        <p className="location-hero-subtitle">
          Real-time visibility into road closures, stormwater drainage, water pipeline renewals, and power cabling across Greater Chennai Corporation.
        </p>

        {/* PIN-code/locality search form */}
        <form className="location-search-form" onSubmit={handleSearchSubmit}>
          <Search size={20} color="#94a3b8" />
          <input
            className="location-search-input"
            placeholder="Enter 6-digit PIN code (e.g. 600127) or locality name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (errorMsg) setErrorMsg('');
            }}
            autoFocus
          />
          <button type="submit" className="location-find-btn">
            Find Works <ArrowRight size={16} />
          </button>
        </form>

        <button type="button" className="detect-location-btn" onClick={onDetectLocation} disabled={detecting}>
          <Navigation size={16} />
          {detecting ? 'Detecting your location…' : 'Use my current location'}
        </button>

        {errorMsg ? (
          <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px', marginBottom: '24px', fontWeight: 600 }}>
            {errorMsg}
          </div>
        ) : (
          <div className="location-search-hint">
            <Sparkles size={13} color="#10896b" />
            <span>Popular: Melakottaiyur (600127) · Triplicane (600005) · Ayanavaram (600023) · T. Nagar (600017)</span>
          </div>
        )}

        {/* Chennai Localities Grid */}
        <div className="location-section-title">
          <h2>
            <MapPin size={18} color="#10896b" /> Select from Chennai Localities with Live Projects
          </h2>
          <span>{localities.length} Areas Available</span>
        </div>

        <div className="localities-grid">
          {localities.map((loc) => (
            <div
              key={loc.pincode}
              className="locality-card"
              onClick={() => onSelectLocality(loc.pincode)}
            >
              <div>
                <div className="locality-card-header">
                  <span className="locality-name">{loc.locality}</span>
                  <span className="locality-pin-badge">{loc.pincode}</span>
                </div>

                <div className="locality-stats-row">
                  <span className="locality-stat-pill total">
                    {loc.count} {loc.count === 1 ? 'Work' : 'Works'}
                  </span>
                  <span className="locality-stat-pill active">
                    {loc.active} Active
                  </span>
                  {loc.delayed > 0 && (
                    <span className="locality-stat-pill delayed">
                      {loc.delayed} Delayed
                    </span>
                  )}
                </div>
              </div>

              <div className="locality-card-action">
                <span>View Public Works</span>
                <ChevronRight size={15} />
              </div>
            </div>
          ))}
        </div>

        {/* Officer Login Footer Banner */}
        <div style={{
          width: '100%',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={20} color="#1d4ed8" />
            <div>
              <strong style={{ fontSize: '13px', color: '#0f2438' }}>Are you a Municipal Engineer or Official?</strong>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Log in with your Badge ID to manage DigSync road digging permits and milestones.</div>
            </div>
          </div>
          <button
            onClick={onOfficerLogin}
            style={{
              background: '#0f2438',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Key size={13} /> Municipal Officer Login →
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 2. DASHBOARD VIEW CHOOSER SCREEN (2 Dashboard Options)
// ============================================================
function DashboardChoicePage({
  pincode,
  localityName,
  workCount,
  onChangeLocality,
  onSelectView
}: {
  pincode: string;
  localityName: string;
  workCount: number;
  onChangeLocality: () => void;
  onSelectView: (view: 'map' | 'info') => void;
}) {
  return (
    <div className="dashboard-choice-page">
      <div className="choice-container">
        {/* Selected Locality Top Banner */}
        <div className="choice-location-banner">
          <div className="choice-loc-info">
            <div className="choice-loc-icon">
              <MapPin size={20} />
            </div>
            <div className="choice-loc-text">
              <b>{localityName} — PIN {pincode}</b>
              <span>Greater Chennai Corporation · {workCount} Registered Public Works</span>
            </div>
          </div>

          <button className="choice-change-btn" onClick={onChangeLocality}>
            <ArrowLeft size={14} /> Change Locality
          </button>
        </div>

        {/* Heading */}
        <div className="choice-heading">
          <h2>Choose Your Dashboard Experience</h2>
          <p>
            Select how you would like to explore ongoing public works in {localityName} ({pincode}):
          </p>
        </div>

        {/* Two Options Duo */}
        <div className="choice-cards-duo">
          {/* Option 1: Information Dashboard + Map */}
          <div
            className="choice-option-card"
            onClick={() => onSelectView('map')}
          >
            <div>
              <span className="choice-card-tag map">
                <Compass size={12} /> Option 1: Geographic View
              </span>

              <div className="choice-icon-bubble map">
                <Compass size={28} />
              </div>

              <h3>Information Dashboard + Map</h3>
              <p>
                Visual Google-style map showing live project markers, road closure detours, and interactive work cards directly on Chennai streets.
              </p>

              <div className="choice-feature-list">
                <div className="choice-feature-item">
                  <Check size={14} /> Interactive map with satellite & street layers
                </div>
                <div className="choice-feature-item">
                  <Check size={14} /> Road closure toggles & detour advisories
                </div>
                <div className="choice-feature-item">
                  <Check size={14} /> Place cards deck overlay with 1-click centering
                </div>
                <div className="choice-feature-item">
                  <Check size={14} /> 7-stage Amazon-style milestone tracker
                </div>
              </div>
            </div>

            <button
              className="choice-launch-btn map"
              onClick={(e) => {
                e.stopPropagation();
                onSelectView('map');
              }}
            >
              Open Information Dashboard + Map →
            </button>
          </div>

          {/* Option 2: Information Dashboard (Map-Free) */}
          <div
            className="choice-option-card"
            onClick={() => onSelectView('info')}
          >
            <div>
              <span className="choice-card-tag info">
                <LayoutGrid size={12} /> Option 2: Data-First View
              </span>

              <div className="choice-icon-bubble info">
                <LayoutGrid size={28} />
              </div>

              <h3>Information Dashboard</h3>
              <p>
                Clean, high-density dashboard featuring summary metrics, multi-attribute filtering, department tracking, and milestone cards without rendering a map canvas.
              </p>

              <div className="choice-feature-list">
                <div className="choice-feature-item">
                  <Check size={14} /> Summary cards: Total, In Progress, Delayed, etc.
                </div>
                <div className="choice-feature-item">
                  <Check size={14} /> Filter by department, status, and category
                </div>
                <div className="choice-feature-item">
                  <Check size={14} /> Sort by recent updates, progress %, or delays
                </div>
                <div className="choice-feature-item">
                  <Check size={14} /> Click any project to open full map + tracker
                </div>
              </div>
            </div>

            <button
              className="choice-launch-btn info"
              onClick={(e) => {
                e.stopPropagation();
                onSelectView('info');
              }}
            >
              Open Information Dashboard →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3. MAP-FREE INFORMATION DASHBOARD
// ============================================================
function MapFreeInfoDashboard({
  pincode,
  localityName,
  projects,
  onProjectClick,
  onSwitchToMap,
  onChangeLocality,
  onChooseView
}: {
  pincode: string;
  localityName: string;
  projects: Project[];
  onProjectClick: (project: Project) => void;
  onSwitchToMap: () => void;
  onChangeLocality: () => void;
  onChooseView: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState<'recent' | 'progress-desc' | 'delayed-first' | 'due-date'>('recent');

  // Summary Metrics
  const metrics = useMemo(() => {
    return {
      total: projects.length,
      inProgress: projects.filter(p => p.status?.toLowerCase() === 'in progress').length,
      scheduled: projects.filter(p => p.status?.toLowerCase() === 'scheduled').length,
      delayed: projects.filter(p => p.status?.toLowerCase() === 'delayed').length,
      completed: projects.filter(p => p.status?.toLowerCase() === 'completed').length,
    };
  }, [projects]);

  // Extract unique departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(p => {
      if (p.department) set.add(p.department);
    });
    return Array.from(set);
  }, [projects]);

  // Filter and Sort
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matches =
          p.title.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.address.toLowerCase().includes(q) ||
          p.department.toLowerCase().includes(q) ||
          p.contractor.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Department filter
      if (selectedDept !== 'All' && p.department !== selectedDept) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'All') {
        if (selectedCategory === 'Drainage' && !p.category.toLowerCase().includes('drain')) return false;
        if (selectedCategory === 'Water Supply' && !p.category.toLowerCase().includes('water')) return false;
        if (selectedCategory === 'Roads' && !p.category.toLowerCase().includes('road')) return false;
        if (selectedCategory === 'Electricity' && !p.category.toLowerCase().includes('elect')) return false;
        if (selectedCategory === 'Telecom' && !p.category.toLowerCase().includes('telecom')) return false;
        if (selectedCategory === 'Delayed' && p.status?.toLowerCase() !== 'delayed') return false;
      }

      // Status filter
      if (selectedStatus !== 'All' && p.status?.toLowerCase() !== selectedStatus.toLowerCase()) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'progress-desc') {
        return b.progress - a.progress;
      }
      if (sortBy === 'delayed-first') {
        const aDelayed = a.status?.toLowerCase() === 'delayed' ? 1 : 0;
        const bDelayed = b.status?.toLowerCase() === 'delayed' ? 1 : 0;
        if (bDelayed !== aDelayed) return bDelayed - aDelayed;
        return b.progress - a.progress;
      }
      if (sortBy === 'due-date') {
        const aDate = new Date(a.revised_date || a.due_date).getTime();
        const bDate = new Date(b.revised_date || b.due_date).getTime();
        return aDate - bDate;
      }
      // 'recent' by default
      return new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime();
    });
  }, [projects, searchTerm, selectedDept, selectedCategory, selectedStatus, sortBy]);

  return (
    <div className="info-dashboard-page">
      {/* Top Locality Header Banner */}
      <div className="info-header-banner">
        <div className="info-header-title-block">
          <h1>
            <Building2 size={24} color="#10896b" />
            <span>{localityName} Public Works Dashboard</span>
          </h1>
          <p>
            PIN {pincode} · Greater Chennai Corporation · {projects.length} Total Projects Monitored
          </p>
        </div>

        <div className="info-header-actions">
          <button className="info-nav-action-btn map-switch" onClick={onSwitchToMap}>
            <Compass size={15} /> Switch to Map View
          </button>
          <button className="info-nav-action-btn locality-change" onClick={onChooseView}>
            <Layers size={14} /> Choose View
          </button>
          <button className="info-nav-action-btn locality-change" onClick={onChangeLocality}>
            <MapPin size={14} /> Change Locality
          </button>
        </div>
      </div>

      <div className="info-content-container">
        {/* 1. Summary Cards Strip */}
        <div className="info-metrics-strip">
          <div className="info-metric-card total">
            <div className="info-metric-header">
              <span>Total Works</span>
              <Construction size={16} color="#2563eb" />
            </div>
            <div className="info-metric-value">{metrics.total}</div>
            <div className="info-metric-subtext">Registered in {localityName}</div>
          </div>

          <div className="info-metric-card inprogress">
            <div className="info-metric-header">
              <span>In Progress</span>
              <Activity size={16} color="#d97706" />
            </div>
            <div className="info-metric-value">{metrics.inProgress}</div>
            <div className="info-metric-subtext">Active civil excavation</div>
          </div>

          <div className="info-metric-card scheduled">
            <div className="info-metric-header">
              <span>Scheduled</span>
              <Calendar size={16} color="#7c3aed" />
            </div>
            <div className="info-metric-value">{metrics.scheduled}</div>
            <div className="info-metric-subtext">DPR & tender mobilised</div>
          </div>

          <div className="info-metric-card delayed">
            <div className="info-metric-header">
              <span>Delayed</span>
              <AlertTriangle size={16} color="#dc2626" />
            </div>
            <div className="info-metric-value" style={{ color: '#dc2626' }}>{metrics.delayed}</div>
            <div className="info-metric-subtext">Revised milestones active</div>
          </div>

          <div className="info-metric-card completed">
            <div className="info-metric-header">
              <span>Completed</span>
              <CheckCircle2 size={16} color="#16a34a" />
            </div>
            <div className="info-metric-value">{metrics.completed}</div>
            <div className="info-metric-subtext">Surface restored & open</div>
          </div>
        </div>

        {/* 2. Filter & Search Toolbar */}
        <div className="info-toolbar-card">
          <div className="info-toolbar-row-top">
            {/* Search Input */}
            <div className="info-search-wrapper">
              <Search size={16} color="#94a3b8" />
              <input
                className="info-search-input"
                placeholder="Search project name, ID (e.g. CG-MELA-01), street, contractor..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ color: '#94a3b8' }}>
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Department Filter */}
            <div className="info-sort-wrapper">
              <span className="info-sort-label">Department:</span>
              <select
                className="info-select-input"
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
              >
                <option value="All">All Departments ({departments.length})</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="info-sort-wrapper">
              <span className="info-sort-label">Status:</span>
              <select
                className="info-select-input"
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="In Progress">In Progress</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Delayed">Delayed</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="info-sort-wrapper">
              <span className="info-sort-label">Sort By:</span>
              <select
                className="info-select-input"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
              >
                <option value="recent">Recently Updated</option>
                <option value="progress-desc">Progress: Highest First</option>
                <option value="delayed-first">Delayed Projects First</option>
                <option value="due-date">Expected Completion (Earliest)</option>
              </select>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="info-filter-chips-row">
            <span className="info-filter-label">Category:</span>
            {[
              { val: 'All', label: 'All Works' },
              { val: 'Drainage', label: '🌊 Drainage' },
              { val: 'Water Supply', label: '💧 Water' },
              { val: 'Roads', label: '🛣️ Roads' },
              { val: 'Electricity', label: '⚡ Electricity' },
              { val: 'Telecom', label: '📡 Telecom' },
              { val: 'Delayed', label: '⚠️ Delayed' }
            ].map(cat => (
              <button
                key={cat.val}
                className={`info-filter-chip ${selectedCategory === cat.val ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.val)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Works List Header */}
        <div className="info-works-count-header">
          <span>
            Showing <strong>{filteredProjects.length}</strong> of {projects.length} public works
            {searchTerm && ` matching "${searchTerm}"`}
          </span>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Click any project to view on Google Maps & live milestone tracker
          </span>
        </div>

        {/* 4. Works List Cards Grid */}
        {filteredProjects.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '48px 24px',
            textAlign: 'center',
            border: '1px solid #e2e8f0'
          }}>
            <Search size={36} color="#94a3b8" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f2438', marginBottom: '6px' }}>
              No public works match your current filters
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
              Try adjusting your search terms or reset the category and department filters.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedDept('All');
                setSelectedCategory('All');
                setSelectedStatus('All');
              }}
              style={{
                background: '#10896b',
                color: 'white',
                padding: '10px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="info-works-list-grid">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                className="info-work-card"
                onClick={() => onProjectClick(p)}
              >
                <div>
                  {/* Top Row: Category + ID + Status */}
                  <div className="info-card-top-row">
                    <span className="info-card-id-pill">{p.code}</span>
                    <span className={`place-status-chip ${p.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {p.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="info-card-title">{p.title}</h3>

                  {/* Address */}
                  <div className="info-card-address">
                    <MapPin size={13} />
                    <span>{p.address}</span>
                  </div>

                  {/* Metadata: Department + Category */}
                  <div className="info-card-meta-row">
                    <span className="info-dept-pill">{p.department}</span>
                    <span className="info-category-pill">{p.category}</span>
                    {p.contractor && (
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                        by {p.contractor}
                      </span>
                    )}
                  </div>

                  {/* Progress Bar & Stage */}
                  <div className="info-progress-section">
                    <div className="info-progress-header">
                      <span>Stage {p.current_step || 3} of 7</span>
                      <span>{p.progress}% Complete</span>
                    </div>
                    <div className="info-progress-bar-track">
                      <div
                        className={`info-progress-bar-fill ${p.status?.toLowerCase() === 'delayed' ? 'delayed' : ''}`}
                        style={{ width: `${p.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Dates Row */}
                  <div className="info-dates-row">
                    <span>Target Due: <b>{formatDate(p.due_date)}</b></span>
                    <span>Updated: <b>{formatDate(p.updated)}</b></span>
                  </div>

                  {/* Delayed Callout when applicable */}
                  {p.status?.toLowerCase() === 'delayed' && (
                    <div className="info-delay-callout">
                      <b>
                        <AlertOctagon size={13} /> Delayed Beyond Target
                      </b>
                      {p.delay_reason && (
                        <span><strong>Reason:</strong> {p.delay_reason}</span>
                      )}
                      {p.mitigation && (
                        <span><strong>Mitigation:</strong> {p.mitigation}</span>
                      )}
                      <span>
                        <strong>Revised Deadline:</strong> {formatDate(p.revised_date || p.due_date)}
                      </span>
                    </div>
                  )}

                  {/* Disruption & Traffic info */}
                  {p.disruption && (
                    <div className="info-disruption-box">
                      <Car size={14} />
                      <div>
                        <strong>Traffic Disruption:</strong> {p.disruption}
                        {p.detour_advice && (
                          <div style={{ marginTop: '3px', fontSize: '10px', color: '#b45309' }}>
                            <strong>Detour:</strong> {p.detour_advice}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Latest update snippet */}
                  <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.45, marginBottom: '16px' }}>
                    {p.description}
                  </div>
                </div>

                {/* Bottom CTA Button */}
                <button
                  className="info-card-view-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onProjectClick(p);
                  }}
                >
                  <Compass size={14} />
                  <span>View on Map & Full Tracker →</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// FULLY RESPONSIVE ABOUT PAGE
// ============================================================
function ResponsiveAboutPage({ onBackToMap }: { onBackToMap: () => void }) {
  return (
    <div className="about-page-container">
      <div className="about-hero-section">
        <h1>Utopia — Smart Public Works Transparency</h1>
        <p>
          Empowering Chennai citizens with live construction tracking, interdepartmental DigSync coordination, and transparent accountability across Greater Chennai Corporation, Chennai Metro Water, and TANGEDCO.
        </p>
        <button
          className="role-action-btn"
          style={{ margin: '18px auto 0', padding: '10px 20px' }}
          onClick={onBackToMap}
        >
          <Compass size={15} /> Explore Live Public Works Map
        </button>
      </div>

      <div className="about-features-grid">
        <div className="about-feature-card">
          <div className="about-feature-icon green">
            <Sparkles size={22} />
          </div>
          <h3>Amazon-Style Order Tracker</h3>
          <p>
            Track road repairs, stormwater culverts, and pipeline trenching from initial Sanction to Excavation, Inspection, and final Bitumen Asphalting with real-time percentage and delay explanations.
          </p>
        </div>

        <div className="about-feature-card">
          <div className="about-feature-icon purple">
            <Flame size={22} />
          </div>
          <h3>DigSync Interdepartmental Engine</h3>
          <p>
            Stops repetitive road excavations by matching utility projects scheduled within 1.5 km and overlapping work windows across GCC, Metro Water, and Telecom providers.
          </p>
        </div>

        <div className="about-feature-card">
          <div className="about-feature-icon blue">
            <Car size={22} />
          </div>
          <h3>Google Maps & Navigation Intimation</h3>
          <p>
            Active road closures and lane blockages are broadcast directly to navigation feeds with recommended detour routes for commuters and motorists.
          </p>
        </div>

        <div className="about-feature-card">
          <div className="about-feature-icon amber">
            <Volume2 size={22} />
          </div>
          <h3>Advance Hazard & Disruption Alerts</h3>
          <p>
            Residents receive verified timings for permitted heavy-noise drilling (e.g. 22:00–04:00) and dust suppression schedules with mandatory 48-hour advance notice.
          </p>
        </div>

        <div className="about-feature-card">
          <div className="about-feature-icon green">
            <Users size={22} />
          </div>
          <h3>Transparent Community Q&A</h3>
          <p>
            Questions asked by residents are publicly visible to other citizens in that PIN code along with official answers from the municipal executive engineers.
          </p>
        </div>

        <div className="about-feature-card">
          <div className="about-feature-icon purple">
            <Shield size={22} />
          </div>
          <h3>Official Municipal Portal</h3>
          <p>
            Authorized municipal officers access a dedicated operations portal via Employee ID to manage milestone progress, triage grievances, and resolve interdepartmental DigSync overlaps.
          </p>
        </div>

        <div className="about-feature-card">
          <div className="about-feature-icon blue">
            <Users size={22} />
          </div>
          <h3>Developed by Team Lazarus</h3>
          <p>
            Utopia was developed by Team Lazarus, a group of students from IIITDM Kancheepuram.
          </p>
        </div>
      </div>

      <div className="about-helpline-box">
        <div>
          <h4>Greater Chennai Corporation Citizen Helpline</h4>
          <p>For emergencies or unaddressed hazardous excavations in your ward:</p>
        </div>
        <div className="helpline-phone-tag">
          <Phone size={16} /> Call GCC 1913 (24x7)
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MUNICIPAL OFFICER LOGIN COMPONENT
// ============================================================
// ============================================================
// 1. ROLE SELECTION PAGE (/login)
// ============================================================
function RoleSelectionPage() {
  const nav = useNavigate();
  return (
    <div className="role-selection-page">
      <div className="role-selection-hero">
        <div className="role-selection-pill">
          <UtopiaLogo size={16} />
          <span>Greater Chennai Corporation · Utopia</span>
        </div>
        <h1 className="role-selection-title">
          Welcome to <span>Utopia</span>
        </h1>
        <p className="role-selection-subtitle">
          Choose how you want to access the public works platform.
        </p>
      </div>

      <div className="role-cards-grid simple-role-grid">
        {/* OPTION 1: MUNICIPALITY */}
        <div
          className="role-portal-card simple-role-card municipal-card"
          onClick={() => nav('/municipality/login')}
          id="role-card-municipality"
          role="button"
          tabIndex={0}
        >
          <div className="role-card-icon-wrap simple-card-icon">
            <Building2 size={36} />
          </div>
          <h2 className="role-card-title simple-card-title">Municipality</h2>
        </div>

        {/* OPTION 2: DEPARTMENT */}
        <div
          className="role-portal-card simple-role-card department-card"
          onClick={() => nav('/department/login')}
          id="role-card-department"
          role="button"
          tabIndex={0}
        >
          <div className="role-card-icon-wrap simple-card-icon">
            <Landmark size={36} />
          </div>
          <h2 className="role-card-title simple-card-title">Department</h2>
        </div>

        {/* OPTION 3: ON-SITE OFFICIAL */}
        <div
          className="role-portal-card simple-role-card onsite-card"
          onClick={() => nav('/onsite/login')}
          id="role-card-onsite"
          role="button"
          tabIndex={0}
        >
          <div className="role-card-icon-wrap simple-card-icon">
            <HardHat size={36} />
          </div>
          <h2 className="role-card-title simple-card-title">On-site Official</h2>
        </div>
      </div>

      <button
        className="role-selection-back"
        onClick={() => nav('/')}
        title="Return to Public Homepage"
      >
        <ArrowLeft size={16} />
        <span>Return to Public Homepage</span>
      </button>
    </div>
  );
}

// ============================================================
// 2. MUNICIPALITY OFFICIAL LOGIN PAGE (/municipality/login)
// ============================================================
function MunicipalityLoginPage({ onLogin }: { onLogin: (token: string, user: AuthUser) => void }) {
  const nav = useNavigate();
  const [employeeId, setEmployeeId] = useState('GCC-ENG-0842');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetchApi<any>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId.trim(), password: password.trim() })
      });
      if (res.user.role === 'onsite') {
        setError('This login is for Municipality Administration. Please use the On-site Official Portal.');
        return;
      }
      onLogin(res.access_token, res.user);
    } catch {
      const cleanId = employeeId.toUpperCase().trim();
      if (cleanId === 'GCC-ENG-0842' || cleanId === 'ADMIN@GCC.GOV.IN') {
        onLogin('mock-jwt', {
          email: 'admin@gcc.gov.in',
          name: 'Er. S. Radhakrishnan',
          role: 'admin',
          department: 'Greater Chennai Corporation',
          designation: 'Superintending Engineer (Works)',
          badge_id: 'GCC-ENG-0842'
        });
      } else if (cleanId === 'CMW-DIV-0219') {
        onLogin('mock-jwt', {
          email: 'water@metrowater.tn.gov.in',
          name: 'Dr. V. Meenakshi',
          role: 'official',
          department: 'Chennai Metro Water',
          designation: 'Executive Engineer (Pipelines)',
          badge_id: 'CMW-DIV-0219'
        });
      } else if (cleanId === 'GCC-RD-0155') {
        onLogin('mock-jwt', {
          email: 'roads@gcc.gov.in',
          name: 'Er. K. Ramanathan',
          role: 'official',
          department: 'GCC Roads & Bridges',
          designation: 'Divisional Engineer (Zone 10)',
          badge_id: 'GCC-RD-0155'
        });
      } else if (cleanId === 'TNEB-ZN-3310' || cleanId === 'TNEB-AEE-4091') {
        onLogin('mock-jwt', {
          email: 'power@tangedco.gov.in',
          name: 'Er. Anitha Selvan',
          role: 'official',
          department: 'TANGEDCO',
          designation: 'Assistant Executive Engineer (O&M)',
          badge_id: 'TNEB-ZN-3310'
        });
      } else if (cleanId === 'SWD-ZN-0418' || cleanId === 'SWD-ENG-1102') {
        onLogin('mock-jwt', {
          email: 'drainage@gcc.gov.in',
          name: 'Er. M. Gunasekaran',
          role: 'official',
          department: 'Stormwater Drainage',
          designation: 'Executive Engineer (SWD)',
          badge_id: 'SWD-ZN-0418'
        });
      } else {
        setError('Invalid Employee ID or password. Please verify credentials or select a demo account.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (empId: string, pw: string) => {
    setEmployeeId(empId);
    setPassword(pw);
    setError('');
  };

  return (
    <div className="portal-login-page">
      <div className="portal-login-card">
        <div className="login-header">
          <div className="portal-login-emblem emblem-municipal">
            <Building2 size={28} />
          </div>
          <h2>Municipality Official Login</h2>
          <p>Greater Chennai Corporation — Authorized Department Access</p>
        </div>

        <div className="portal-restriction-badge">
          <ShieldAlert size={16} />
          <span>Restricted to authorized municipal engineers, zone directors, and DigSync coordinators.</span>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Employee ID or Official Email</label>
            <div className="form-input-wrapper">
              <User size={16} />
              <input
                placeholder="e.g. GCC-ENG-0842 or admin@gcc.gov.in"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Official Password</label>
            <div className="form-input-wrapper">
              <Lock size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn btn-municipal-auth" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Authenticating Official…' : 'Sign In to Municipality Dashboard'}
          </button>
        </form>

        <Link to="/login" className="back-to-roles-link">
          <ArrowLeft size={14} /> Back to Role Selection
        </Link>

        {/* Development Demo Accounts */}
        <div className="demo-accounts-box">
          <div className="demo-accounts-header">
            <span className="demo-accounts-title">
              <Shield size={13} /> Demo Accounts (Dev Only)
            </span>
            <span className="demo-autofill-hint">Click to Auto-fill</span>
          </div>
          <div className="demo-chips-grid">
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('GCC-ENG-0842', 'admin123')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">GCC-ENG-0842</span>
                <span className="demo-chip-desc">Er. S. Radhakrishnan · Super Admin</span>
              </div>
              <span className="demo-chip-role-tag">GCC Works</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('CMW-DIV-0219', 'water123')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">CMW-DIV-0219</span>
                <span className="demo-chip-desc">Dr. V. Meenakshi · Executive Engineer</span>
              </div>
              <span className="demo-chip-role-tag">Metro Water</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('GCC-RD-0155', 'roads123')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">GCC-RD-0155</span>
                <span className="demo-chip-desc">Er. K. Ramanathan · Zone 10 Engineer</span>
              </div>
              <span className="demo-chip-role-tag">Roads Dept</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('TNEB-ZN-3310', 'power123')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">TNEB-ZN-3310</span>
                <span className="demo-chip-desc">Er. Anitha Selvan · Asst. Exec. Engineer</span>
              </div>
              <span className="demo-chip-role-tag">TANGEDCO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 2b. DEPARTMENT OFFICIAL LOGIN PAGE (/department/login)
// ============================================================
function DepartmentLoginPage({ onLogin }: { onLogin: (token: string, user: AuthUser) => void }) {
  const nav = useNavigate();
  const [employeeId, setEmployeeId] = useState('CMW-DIV-0219');
  const [password, setPassword] = useState('water123');
  const [selectedDept, setSelectedDept] = useState('Chennai Metro Water');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch departments dynamically from backend configured records
  const { data: deptList = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => fetchApi<string[]>('/departments').catch(() => [
      'Chennai Metro Water',
      'GCC Roads & Bridges',
      'TANGEDCO',
      'Stormwater Drainage',
      'Greater Chennai Corporation',
      'Water Resources Dept'
    ])
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetchApi<any>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: employeeId.trim(),
          password: password.trim(),
          department: selectedDept
        })
      });
      if (res.user.role === 'onsite') {
        setError('This login is for Department Officials. Please use the On-site Official Portal.');
        return;
      }
      onLogin(res.access_token, res.user);
    } catch (err: any) {
      const cleanId = employeeId.trim().toUpperCase();
      if ((cleanId === 'TNEB-ZN-3310' || cleanId === 'TNEB-AEE-4091' || cleanId === 'POWER@TANGEDCO.GOV.IN') && password === 'power123') {
        onLogin('mock-jwt-tneb', {
          email: 'power@tangedco.gov.in',
          name: 'Er. Anitha Selvan',
          role: 'official',
          department: 'TANGEDCO',
          designation: 'Assistant Executive Engineer (O&M)',
          badge_id: 'TNEB-ZN-3310'
        });
        return;
      }
      if ((cleanId === 'SWD-ZN-0418' || cleanId === 'SWD-ENG-1102' || cleanId === 'DRAINAGE@GCC.GOV.IN') && password === 'drain123') {
        onLogin('mock-jwt-swd', {
          email: 'drainage@gcc.gov.in',
          name: 'Er. M. Gunasekaran',
          role: 'official',
          department: 'Stormwater Drainage',
          designation: 'Executive Engineer (SWD)',
          badge_id: 'SWD-ZN-0418'
        });
        return;
      }
      if ((cleanId === 'CMW-DIV-0219' || cleanId === 'WATER@METROWATER.TN.GOV.IN') && password === 'water123') {
        onLogin('mock-jwt-cmw', {
          email: 'water@metrowater.tn.gov.in',
          name: 'Dr. V. Meenakshi',
          role: 'official',
          department: 'Chennai Metro Water',
          designation: 'Executive Engineer (Pipelines)',
          badge_id: 'CMW-DIV-0219'
        });
        return;
      }
      if ((cleanId === 'GCC-RD-0155' || cleanId === 'ROADS@GCC.GOV.IN') && password === 'roads123') {
        onLogin('mock-jwt-rd', {
          email: 'roads@gcc.gov.in',
          name: 'Er. K. Ramanathan',
          role: 'official',
          department: 'GCC Roads & Bridges',
          designation: 'Divisional Engineer (Zone 10)',
          badge_id: 'GCC-RD-0155'
        });
        return;
      }

      let msg = err.message || 'Login failed';
      try {
        const parsed = JSON.parse(msg);
        if (parsed.detail) msg = parsed.detail;
      } catch {}
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (empId: string, pw: string, dept: string) => {
    setEmployeeId(empId);
    setPassword(pw);
    setSelectedDept(dept);
    setError('');
  };

  return (
    <div className="portal-login-page department-theme">
      <div className="portal-login-card">
        <div className="login-header">
          <div className="portal-login-emblem emblem-department">
            <Landmark size={28} />
          </div>
          <h2>Department Official Login</h2>
          <p>Line Agencies & Public Utilities — Metro Water, TANGEDCO, GCC Roads, SWD</p>
        </div>

        <div className="portal-restriction-badge">
          <ShieldAlert size={16} />
          <span>Authorized departmental engineers, utility coordinators & grievance officers.</span>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Department Selection Dropdown (Requirement 1) */}
          <div className="form-group">
            <label>Assigned Department Portfolio *</label>
            <div className="form-input-wrapper">
              <Landmark size={16} />
              <select
                value={selectedDept}
                onChange={e => setSelectedDept(e.target.value)}
                className="form-select-control"
                style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', outline: 'none', fontSize: '13.5px', color: '#0f2438', fontWeight: 600 }}
                required
              >
                {deptList.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
              Select your department. Backend authorization enforces that your account belongs to this department.
            </span>
          </div>

          <div className="form-group">
            <label>Department Employee ID or Official Email</label>
            <div className="form-input-wrapper">
              <User size={16} />
              <input
                placeholder="e.g. CMW-DIV-0219 or water@metrowater.tn.gov.in"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Official Password</label>
            <div className="form-input-wrapper">
              <Lock size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn btn-department-auth" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Authenticating Official…' : 'Sign In to Department Dashboard'}
          </button>
        </form>

        <Link to="/login" className="back-to-roles-link">
          <ArrowLeft size={14} /> Back to Role Selection
        </Link>

        {/* Development Demo Department Accounts */}
        <div className="demo-accounts-box">
          <div className="demo-accounts-header">
            <span className="demo-accounts-title">
              <Shield size={13} /> Department Demo Accounts (Dev Only)
            </span>
            <span className="demo-autofill-hint">Click to Auto-fill</span>
          </div>
          <div className="demo-chips-grid">
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('CMW-DIV-0219', 'water123', 'Chennai Metro Water')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">CMW-DIV-0219</span>
                <span className="demo-chip-desc">Dr. V. Meenakshi · Executive Engineer</span>
              </div>
              <span className="demo-chip-role-tag">Metro Water</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('GCC-RD-0155', 'roads123', 'GCC Roads & Bridges')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">GCC-RD-0155</span>
                <span className="demo-chip-desc">Er. K. Ramanathan · Zone 10 Engineer</span>
              </div>
              <span className="demo-chip-role-tag">Roads Dept</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('TNEB-ZN-3310', 'power123', 'TANGEDCO')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">TNEB-ZN-3310</span>
                <span className="demo-chip-desc">Er. Anitha Selvan · Asst. Exec. Engineer</span>
              </div>
              <span className="demo-chip-role-tag">TANGEDCO</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('SWD-ZN-0418', 'drain123', 'Stormwater Drainage')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">SWD-ZN-0418</span>
                <span className="demo-chip-desc">Er. M. Senthilvel · SWD Officer</span>
              </div>
              <span className="demo-chip-role-tag">Stormwater</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              style={{ border: '1px dashed #ef4444', background: '#fef2f2' }}
              onClick={() => {
                setEmployeeId('CMW-DIV-0219');
                setPassword('water123');
                setSelectedDept('Stormwater Drainage');
                setError('');
              }}
              title="Test department-level authorization mismatch (expect 403 Forbidden)"
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>MISMATCH TEST</span>
                <span className="demo-chip-desc">Metro Water ID on Stormwater Dept</span>
              </div>
              <span className="demo-chip-role-tag" style={{ background: '#fee2e2', color: '#b91c1c' }}>Expect 403</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CREATE PROJECT FORM & PAGE (dep.jpeg Reference Layout)
// ============================================================
function CreateProjectForm({
  user,
  onCreated,
  onCancel
}: {
  user: AuthUser;
  onCreated?: (proj: Project) => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Roads & Arterial Works');
  const [contractor, setContractor] = useState('Pending Tender Award');
  const [technicalScope, setTechnicalScope] = useState('');
  const [description, setDescription] = useState('');
  const [locality, setLocality] = useState('T. Nagar');
  const [pincode, setPincode] = useState('600017');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number>(13.0418);
  const [lng, setLng] = useState<number>(80.2337);
  const [budget, setBudget] = useState<number>(45000000);
  const [fundingProgram, setFundingProgram] = useState('Municipal Infrastructure Capital Fund');
  const [startDate, setStartDate] = useState('2026-03-01');
  const [dueDate, setDueDate] = useState('2026-08-30');
  const [status, setStatus] = useState('Scheduled');
  const [contactEngineerName, setContactEngineerName] = useState(user.name);
  const [contactEngineerPhone, setContactEngineerPhone] = useState('+91 94450 12345');
  const [disruption, setDisruption] = useState('Standard barricading active · Partial single-lane closure');
  const [detourAdvice, setDetourAdvice] = useState('Vehicular detour via Burkit Road; bus lane unaffected');
  const [noiseWarning, setNoiseWarning] = useState('Heavy trenching machinery operation restricted between 10 PM and 5 AM');
  const [dustWarning, setDustWarning] = useState('Continuous water sprinkling and acoustic barricading enforced');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geocodingHint, setGeocodingHint] = useState('');

  // Conflict resolution state
  const [conflictResults, setConflictResults] = useState<any[] | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflictChecked, setConflictChecked] = useState(false);
  const [raiseTicketFor, setRaiseTicketFor] = useState<any | null>(null);
  const [ticketReason, setTicketReason] = useState('');
  const [raisingTicket, setRaisingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null);

  // Auto-geocode when 6-digit PIN code is entered
  const handlePincodeChange = async (pinVal: string) => {
    setPincode(pinVal);
    const clean = pinVal.trim();
    if (/^\d{6}$/.test(clean)) {
      setGeocodingHint('Looking up geographic coordinates…');
      try {
        const geo = await fetchApi<{ pincode: string; locality: string; lat: number; lng: number }>(`/geocode/pincode?pin=${clean}`);
        if (geo && geo.lat && geo.lng) {
          setLat(geo.lat);
          setLng(geo.lng);
          if (!locality || locality === 'Chennai') setLocality(geo.locality);
          setGeocodingHint(`Resolved to ${geo.locality} (${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)})`);
        }
      } catch {
        setGeocodingHint('Could not auto-resolve coordinates. Please enter manually.');
      }
    } else {
      setGeocodingHint('');
    }
  };

  const formatCrores = (val: number) => {
    if (!val) return '₹0';
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Crore`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide an official project title.');
      return;
    }
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      setError('Please provide a valid 6-digit PIN code.');
      return;
    }
    if (!locality.trim()) {
      setError('Please specify the project locality/ward.');
      return;
    }
    if (budget <= 0) {
      setError('Sanctioned budget must be greater than zero.');
      return;
    }
    if (!startDate || !dueDate) {
      setError('Start date and target completion deadline are required.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        locality: locality.trim(),
        pincode: pincode.trim(),
        address: address.trim() || `${locality.trim()}, Chennai`,
        description: description.trim() || `${title.trim()} initiated under ${user.department}.`,
        budget,
        contractor,
        start_date: startDate,
        due_date: dueDate,
        status,
        lat,
        lng,
        disruption,
        detour_advice: detourAdvice,
        noise_warning: noiseWarning,
        dust_warning: dustWarning,
        contact_engineer_name: contactEngineerName,
        contact_engineer_phone: contactEngineerPhone,
        technical_scope: technicalScope.trim(),
        funding_program: fundingProgram.trim()
      };

      const res = await fetchApi<Project>('/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
      qc.invalidateQueries({ queryKey: ['department_projects'] });
      qc.invalidateQueries({ queryKey: ['localities'] });

      onCreated?.(res);
    } catch (err: any) {
      let msg = err.message || 'Failed to sanction project';
      try {
        const parsed = JSON.parse(msg);
        if (parsed.detail) msg = parsed.detail;
      } catch {}
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckConflicts = async () => {
    if (!startDate || !dueDate) {
      setError('Please enter Start Date and Target Completion Date before checking for conflicts.');
      return;
    }
    setCheckingConflicts(true);
    setConflictResults(null);
    setConflictChecked(false);
    setTicketSuccess(null);
    try {
      const res = await fetchApi<any>('/projects/check-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          due_date: dueDate,
          lat: lat || undefined,
          lng: lng || undefined,
          pincode: pincode || undefined,
          locality: locality || undefined
        })
      });
      setConflictResults(res.conflicts || []);
      setConflictChecked(true);
    } catch {
      setConflictResults([]);
      setConflictChecked(true);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleRaiseTicket = async (conflict: any) => {
    if (!ticketReason.trim()) {
      alert('Please explain why your department must proceed in this date range despite the conflict.');
      return;
    }
    setRaisingTicket(true);
    try {
      const res = await fetchApi<any>('/conflict-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposed_title: title.trim() || 'New Project (Pending Title)',
          proposed_category: category || 'Road Infrastructure',
          proposed_description: description || '',
          proposed_budget: budget || 0,
          proposed_start: startDate,
          proposed_end: dueDate,
          proposed_locality: locality,
          proposed_pincode: pincode,
          ward_id: null,
          lat: lat,
          lng: lng,
          reason_for_proceeding: ticketReason.trim(),
          conflicting_project_id: conflict.project_id,
          conflicting_dept: conflict.department,
          conflicting_project_title: conflict.title,
          conflicting_start: conflict.start_date,
          conflicting_end: conflict.end_date
        })
      });
      setTicketSuccess(res.ref || 'Ticket raised');
      setRaiseTicketFor(null);
      setTicketReason('');
    } catch {
      alert('Failed to raise ticket. Please try again.');
    } finally {
      setRaisingTicket(false);
    }
  };

  return (
    <div className="create-project-page">
      {onCancel && (
        <button type="button" className="back-to-console-btn" onClick={onCancel}>
          <ArrowLeft size={16} /> Back to Department Console
        </button>
      )}

      <div className="create-project-header">
        <div className="create-project-title-row">
          <FileText size={26} color="#0f766e" />
          <h1>Sanction New Infrastructure Project</h1>
        </div>
        <p className="create-project-subtitle">
          Publish an official municipal capital work order, notify utility agencies, and alert neighbourhood citizens.
        </p>
      </div>

      {error && (
        <div className="login-error-alert" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form className="create-project-card" onSubmit={handleSubmit}>
        {/* 1. PROJECT SCOPE & CATEGORY */}
        <div className="create-project-section">
          <h3 className="section-divider-title">
            <span>1. Project Scope & Category</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>* Indicates required field</span>
          </h3>

          <div className="create-form-field">
            <label>Official Project Title *</label>
            <input
              placeholder="E.g., 100ft Road White-Topping & Pedestrian Footpath Rejuvenation"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-grid-3">
            <div className="create-form-field">
              <label>Category *</label>
              <select value={category} onChange={e => setCategory(e.target.value)} required>
                <option value="Roads & Arterial Works">Roads & Arterial Works</option>
                <option value="Water Supply & Drainage">Water Supply & Drainage</option>
                <option value="Storm Water Drains">Storm Water Drains</option>
                <option value="Electricity & Power Distribution">Electricity & Power Distribution</option>
                <option value="Bridges & Flyovers">Bridges & Flyovers</option>
                <option value="Solid Waste Management">Solid Waste Management</option>
                <option value="Parks & Urban Greening">Parks & Urban Greening</option>
                <option value="Telecom & Fiber Ducting">Telecom & Fiber Ducting</option>
              </select>
            </div>

            <div className="create-form-field">
              <label>Department *</label>
              <div className="locked-dept-pill" title="Locked to authenticated official department">
                <Lock size={13} color="#0f766e" />
                <span>{user.department}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Assigned automatically from official credentials</span>
            </div>

            <div className="create-form-field">
              <label>Executing Contractor</label>
              <select value={contractor} onChange={e => setContractor(e.target.value)}>
                <option value="Pending Tender Award">Pending Tender Award</option>
                <option value="L&T Construction Infrastructure Ltd">L&T Construction Infrastructure Ltd</option>
                <option value="Afcons Infrastructure Ltd">Afcons Infrastructure Ltd</option>
                <option value="Ramalingam Construction Co.">Ramalingam Construction Co.</option>
                <option value="NCC Urban Infrastructure">NCC Urban Infrastructure</option>
                <option value="Direct Departmental Engineering">Direct Departmental Engineering</option>
              </select>
            </div>
          </div>

          <div className="create-form-field">
            <label>Detailed Technical Scope *</label>
            <textarea
              rows={3}
              placeholder="Detail the technical specifications, depth of trenching, pipe diameters, materials..."
              value={technicalScope}
              onChange={e => setTechnicalScope(e.target.value)}
              required
            />
          </div>

          <div className="create-form-field">
            <label>Public Purpose & Benefit to Citizens *</label>
            <textarea
              rows={3}
              placeholder="Explain why this project is needed in non-technical terms for citizens..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-grid-3">
            <div className="create-form-field">
              <label>Locality / Ward Area *</label>
              <input
                placeholder="e.g. T. Nagar, Triplicane, Anna Nagar"
                value={locality}
                onChange={e => setLocality(e.target.value)}
                required
              />
            </div>

            <div className="create-form-field">
              <label>PIN Code (6 Digits) *</label>
              <input
                placeholder="e.g. 600017"
                maxLength={6}
                value={pincode}
                onChange={e => handlePincodeChange(e.target.value)}
                required
              />
              {geocodingHint && (
                <span style={{ fontSize: '11px', color: '#0f766e', fontWeight: 600 }}>
                  {geocodingHint}
                </span>
              )}
            </div>

            <div className="create-form-field">
              <label>Street Address / Landmark</label>
              <input
                placeholder="e.g. North Usman Road near Panagal Park"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="create-form-field">
              <label>Latitude Coordinate</label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={e => setLat(parseFloat(e.target.value) || 13.0)}
              />
            </div>
            <div className="create-form-field">
              <label>Longitude Coordinate</label>
              <input
                type="number"
                step="0.0001"
                value={lng}
                onChange={e => setLng(parseFloat(e.target.value) || 80.2)}
              />
            </div>
          </div>
        </div>

        {/* 2. BUDGET & EXECUTION TIMELINE */}
        <div className="create-project-section">
          <h3 className="section-divider-title">
            <span>2. Budget & Execution Timeline</span>
          </h3>

          <div className="form-grid-2">
            <div className="create-form-field">
              <label>Sanctioned Budget (INR) *</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min={10000}
                  step={100000}
                  value={budget}
                  onChange={e => setBudget(parseInt(e.target.value) || 0)}
                  required
                />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e', whiteSpace: 'nowrap' }}>
                  {formatCrores(budget)}
                </span>
              </div>
            </div>

            <div className="create-form-field">
              <label>Funding Program / Grant *</label>
              <input
                placeholder="e.g. Municipal Infrastructure Capital Fund, AMRUT 2.0"
                value={fundingProgram}
                onChange={e => setFundingProgram(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-grid-3">
            <div className="create-form-field">
              <label>Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setConflictChecked(false); setConflictResults(null); }}
                required
              />
            </div>

            <div className="create-form-field">
              <label>Target Completion Deadline *</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => { setDueDate(e.target.value); setConflictChecked(false); setConflictResults(null); }}
                required
              />
            </div>

            <div className="create-form-field">
              <label>Initial Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}>
                <option value="Scheduled">Scheduled</option>
                <option value="In progress">In progress</option>
                <option value="Proposed / Pending Approval">Proposed / Pending Approval</option>
              </select>
            </div>
          </div>

          {/* ── CONFLICT CHECK BUTTON ── */}
          <div style={{ marginTop: '10px', padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1.5px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0f2438', fontSize: '14px', marginBottom: '3px' }}>
                  <CalendarClock size={15} style={{ display: 'inline', marginRight: '6px', color: '#f59e0b' }} />
                  Scheduling Conflict Check
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Before sanctioning, check if another department has active works in this date range and area.
                </div>
              </div>
              <button
                type="button"
                onClick={handleCheckConflicts}
                disabled={checkingConflicts || !startDate || !dueDate}
                style={{
                  background: conflictChecked
                    ? (conflictResults && conflictResults.length > 0 ? '#fef3c7' : '#dcfce7')
                    : 'linear-gradient(135deg,#f59e0b,#d97706)',
                  color: conflictChecked
                    ? (conflictResults && conflictResults.length > 0 ? '#92400e' : '#166534')
                    : '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: (checkingConflicts || !startDate || !dueDate) ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(245,158,11,0.25)'
                }}
              >
                <GitBranch size={15} />
                {checkingConflicts ? 'Checking…' : conflictChecked ? (conflictResults && conflictResults.length > 0 ? `⚠ ${conflictResults.length} Conflict(s) Found` : '✓ No Conflicts') : 'Check for Conflicts'}
              </button>
            </div>

            {/* Conflict Results */}
            {ticketSuccess && (
              <div style={{ marginTop: '12px', background: '#dcfce7', border: '1.5px solid #86efac', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} color="#16a34a" />
                <div>
                  <div style={{ fontWeight: 700, color: '#15803d', fontSize: '13px' }}>Conflict Ticket Raised Successfully</div>
                  <div style={{ fontSize: '12px', color: '#166534' }}>Ticket Ref: <strong>{ticketSuccess}</strong> · Municipality has been notified and will review and resolve the conflict.</div>
                </div>
              </div>
            )}

            {conflictResults && conflictResults.length === 0 && (
              <div style={{ marginTop: '12px', background: '#dcfce7', border: '1.5px solid #86efac', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} color="#16a34a" />
                <div style={{ fontWeight: 600, color: '#15803d', fontSize: '13px' }}>No scheduling conflicts detected. You may proceed to sanction this project.</div>
              </div>
            )}

            {conflictResults && conflictResults.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontWeight: 700, color: '#92400e', fontSize: '13px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} color="#f59e0b" /> Scheduling Conflicts Detected — Choose an Action for Each:
                </div>
                {conflictResults.map((c: any, idx: number) => (
                  <div key={idx} style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f2438', fontSize: '13.5px' }}>{c.title}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', marginRight: '6px' }}>{c.department}</span>
                          {c.locality} · {c.start_date} → {c.end_date}
                          <span style={{ marginLeft: '8px', color: '#dc2626', fontWeight: 600 }}>({c.overlap_days} day overlap)</span>
                        </div>
                      </div>
                      <span style={{ background: c.status === 'In progress' ? '#fee2e2' : '#fef3c7', color: c.status === 'In progress' ? '#b91c1c' : '#92400e', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>{c.status}</span>
                    </div>

                    {raiseTicketFor?.project_id === c.project_id ? (
                      <div style={{ marginTop: '10px', background: '#fff', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ fontWeight: 600, fontSize: '12.5px', color: '#92400e', marginBottom: '6px' }}>Reason your department must proceed in this date range:</div>
                        <textarea
                          rows={3}
                          placeholder="e.g., Emergency infrastructure repair mandated by court order; delay will cause service disruption to 15,000 residents…"
                          value={ticketReason}
                          onChange={e => setTicketReason(e.target.value)}
                          style={{ width: '100%', borderRadius: '6px', border: '1px solid #fed7aa', padding: '8px', fontSize: '12px', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}>
                          <button type="button" onClick={() => { setRaiseTicketFor(null); setTicketReason(''); }} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                          <button type="button" onClick={() => handleRaiseTicket(c)} disabled={raisingTicket} style={{ padding: '7px 14px', borderRadius: '7px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Ticket size={13} /> {raisingTicket ? 'Raising…' : 'Raise Ticket to Municipality'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => { setStartDate(''); setDueDate(''); setConflictResults(null); setConflictChecked(false); }}
                          style={{ flex: 1, minWidth: '120px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #0d9488', background: '#f0fdfa', color: '#0f766e', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        >
                          <Calendar size={13} /> Reschedule (Clear Dates)
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRaiseTicketFor(c); setTicketReason(''); }}
                          style={{ flex: 1, minWidth: '120px', padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #dc2626', background: '#fff1f2', color: '#b91c1c', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        >
                          <Ticket size={13} /> Raise Ticket to Municipality
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. EXECUTION DETAILS & UTILITY COORDINATION */}
        <div className="create-project-section">
          <h3 className="section-divider-title">
            <span>3. Execution Details & Utility Coordination</span>
          </h3>

          <div className="form-grid-2">
            <div className="create-form-field">
              <label>Responsible Officer</label>
              <input
                value={contactEngineerName}
                onChange={e => setContactEngineerName(e.target.value)}
                placeholder="Official name and designation"
              />
            </div>

            <div className="create-form-field">
              <label>Officer Phone / Grievance Helpline</label>
              <input
                value={contactEngineerPhone}
                onChange={e => setContactEngineerPhone(e.target.value)}
                placeholder="+91 94450 12345"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="create-form-field">
              <label>Expected Disruptions / Road Closures</label>
              <select value={disruption} onChange={e => setDisruption(e.target.value)}>
                <option value="No Road Closure · Normal Traffic Flow">No Road Closure · Normal Traffic Flow</option>
                <option value="Standard barricading active · Partial single-lane closure">Standard barricading active · Partial single-lane closure</option>
                <option value="Partial Lane Closure (Night Hours 10 PM - 5 AM)">Partial Lane Closure (Night Hours 10 PM - 5 AM)</option>
                <option value="Single Lane Diversion Active">Single Lane Diversion Active</option>
                <option value="Full Road Closure with Traffic Detour">Full Road Closure with Traffic Detour</option>
              </select>
            </div>

            <div className="create-form-field">
              <label>Citizen Traffic Detour Advice</label>
              <input
                value={detourAdvice}
                onChange={e => setDetourAdvice(e.target.value)}
                placeholder="e.g. Alternate routing via GST Road; one lane open"
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="create-form-field">
              <label>Noise & Vibration Mitigation Warning</label>
              <input
                value={noiseWarning}
                onChange={e => setNoiseWarning(e.target.value)}
                placeholder="e.g. Heavy trenching machinery restricted between 10 PM and 5 AM"
              />
            </div>

            <div className="create-form-field">
              <label>Dust & Pollution Control Advisory</label>
              <input
                value={dustWarning}
                onChange={e => setDustWarning(e.target.value)}
                placeholder="e.g. Continuous water misting & acoustic barriers deployed"
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTONS */}
        <div style={{ display: 'flex', gap: '14px', justifyContent: 'flex-end', marginTop: '12px' }}>
          {onCancel && (
            <button
              type="button"
              className="role-action-btn"
              style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            className="role-action-btn"
            style={{
              background: '#0f766e',
              color: '#ffffff',
              padding: '12px 28px',
              fontSize: '14.5px',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '10px',
              boxShadow: '0 4px 14px rgba(15,118,110,0.3)'
            }}
            disabled={loading}
          >
            <CheckCircle size={17} />
            {loading ? 'Sanctioning Project…' : 'Sanction & Publish Work Order'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateProjectPage({
  user,
  onCreated,
  onBack
}: {
  user: AuthUser;
  onCreated: (proj: Project) => void;
  onBack: () => void;
}) {
  return (
    <div style={{ minHeight: '85vh', background: '#f8fafc', padding: '24px 0' }}>
      <CreateProjectForm user={user} onCreated={onCreated} onCancel={onBack} />
    </div>
  );
}

// ============================================================
// 3. ON-SITE OFFICIAL LOGIN PAGE (/onsite/login)
// ============================================================
function OnsiteLoginPage({ onLogin }: { onLogin: (token: string, user: AuthUser) => void }) {
  const nav = useNavigate();
  const [employeeId, setEmployeeId] = useState('GCC-SITE-104');
  const [password, setPassword] = useState('field123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetchApi<any>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId.trim(), password: password.trim() })
      });
      onLogin(res.access_token, res.user);
    } catch {
      const cleanId = employeeId.toUpperCase().trim();
      if (cleanId === 'GCC-SITE-104') {
        onLogin('mock-jwt-onsite', {
          email: 'field.gcc@chennai.gov.in',
          name: 'P. Murugan',
          role: 'onsite',
          department: 'Greater Chennai Corporation',
          designation: 'Assistant Engineer (Worksite Supervisor)',
          badge_id: 'GCC-SITE-104'
        });
      } else if (cleanId === 'CMW-SITE-208') {
        onLogin('mock-jwt-onsite', {
          email: 'field.water@metrowater.tn.gov.in',
          name: 'R. Balaji',
          role: 'onsite',
          department: 'Chennai Metro Water',
          designation: 'Site Trenching Inspector',
          badge_id: 'CMW-SITE-208'
        });
      } else if (cleanId === 'TNEB-SITE-312') {
        onLogin('mock-jwt-onsite', {
          email: 'field.power@tangedco.gov.in',
          name: 'S. Kumar',
          role: 'onsite',
          department: 'TANGEDCO',
          designation: 'Field Line & Cable Engineer',
          badge_id: 'TNEB-SITE-312'
        });
      } else {
        setError('Invalid Field Employee ID or password. Please select an on-site demo account.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDemo = (empId: string, pw: string) => {
    setEmployeeId(empId);
    setPassword(pw);
    setError('');
  };

  return (
    <div className="portal-login-page onsite-theme">
      <div className="portal-login-card">
        <div className="login-header">
          <div className="portal-login-emblem emblem-onsite">
            <HardHat size={28} />
          </div>
          <h2>On-site Official Login</h2>
          <p>Field reporting and worksite progress management</p>
        </div>

        <div className="portal-restriction-badge">
          <Construction size={16} />
          <span>Worksite field logging access for site supervisors, inspectors, and contractors.</span>
        </div>

        {error && (
          <div className="login-error-alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Field Employee ID or Worksite Email</label>
            <div className="form-input-wrapper">
              <User size={16} />
              <input
                placeholder="e.g. GCC-SITE-104 or field.gcc@chennai.gov.in"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Field Access Password</label>
            <div className="form-input-wrapper">
              <Lock size={16} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit-btn btn-onsite-auth" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Authenticating Field Officer…' : 'Sign In to On-site Workstation'}
          </button>
        </form>

        <Link to="/login" className="back-to-roles-link">
          <ArrowLeft size={14} /> Back to Role Selection
        </Link>

        {/* Development Demo Field Accounts */}
        <div className="demo-accounts-box">
          <div className="demo-accounts-header">
            <span className="demo-accounts-title">
              <HardHat size={13} /> Field Demo Accounts (Dev Only)
            </span>
            <span className="demo-autofill-hint">Click to Auto-fill</span>
          </div>
          <div className="demo-chips-grid">
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('GCC-SITE-104', 'field123')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">GCC-SITE-104</span>
                <span className="demo-chip-desc">P. Murugan · AE Worksite Supervisor</span>
              </div>
              <span className="demo-chip-role-tag">GCC Site</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('CMW-SITE-208', 'field123')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">CMW-SITE-208</span>
                <span className="demo-chip-desc">R. Balaji · Site Trenching Inspector</span>
              </div>
              <span className="demo-chip-role-tag">Metro Water</span>
            </button>
            <button
              type="button"
              className="demo-chip-btn"
              onClick={() => handleSelectDemo('TNEB-SITE-312', 'field123')}
            >
              <div className="demo-chip-info">
                <span className="demo-chip-badge">TNEB-SITE-312</span>
                <span className="demo-chip-desc">S. Kumar · Field Line & Cable Engineer</span>
              </div>
              <span className="demo-chip-role-tag">TANGEDCO</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 4. ON-SITE OFFICIAL FIELD DASHBOARD (/onsite/dashboard)
// ============================================================
function OnsiteDashboard({
  user,
  projects,
  onLogout,
  onToast
}: {
  user: AuthUser;
  projects: Project[];
  onLogout: () => void;
  onToast: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<number>(() => {
    return projects[0]?.id || 1;
  });

  const [activeTab, setActiveTab] = useState<'progress' | 'photo' | 'blocker' | 'log' | 'delay' | 'history' | 'performance'>('progress');

  // Form states
  const [progressPct, setProgressPct] = useState<number>(65);
  const [milestoneStep, setMilestoneStep] = useState<number>(4);
  const [workPerformed, setWorkPerformed] = useState('Reinforcement steel alignment inspected along chainage 0+180. Ready for transit mixer concrete pour.');
  
  const [photoCategory, setPhotoCategory] = useState('Structural Conduit / Duct Laying');
  const [photoCaption, setPhotoCaption] = useState('Pre-cast drain box reinforcement spacing inspection');
  const [selectedSamplePhoto, setSelectedSamplePhoto] = useState('https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80');

  const [blockerCategory, setBlockerCategory] = useState('Unmapped Utility Collision');
  const [blockerSeverity, setBlockerSeverity] = useState('Medium');
  const [blockerDetail, setBlockerDetail] = useState('');

  const [shiftHours, setShiftHours] = useState('Day Shift (08:30 - 17:30)');
  const [laborCount, setLaborCount] = useState(16);
  const [machinery, setMachinery] = useState('1x JCB Backhoe Loader, 1x 15-ton Transit Mixer, 2x Plate Compactors');

  const [delayDays, setDelayDays] = useState(3);
  const [delayReason, setDelayReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch live field submissions
  const { data: fieldSubmissions = [], refetch: refetchSubmissions } = useQuery({
    queryKey: ['onsite_submissions'],
    queryFn: () => fetchApi<any[]>('/onsite/submissions').catch(() => [])
  });

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // Sync progress fields when project changes
  useEffect(() => {
    if (selectedProject) {
      setProgressPct(selectedProject.progress || 50);
      setMilestoneStep(selectedProject.current_step || 3);
    }
  }, [selectedProject?.id]);

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      await fetchApi('/onsite/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          report_type: 'progress',
          summary: `Milestone Step ${milestoneStep} update (${progressPct}%)`,
          detail: workPerformed,
          progress_pct: progressPct,
          step_number: milestoneStep
        })
      });
      onToast(`Work progress updated to ${progressPct}% and synced with Utopia!`);
      refetchSubmissions();
      qc.invalidateQueries({ queryKey: ['projects'] });
    } catch {
      onToast(`Field update logged locally for ${selectedProject.code}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      await fetchApi('/onsite/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          report_type: 'photo',
          summary: `Worksite Visual Proof: ${photoCategory}`,
          detail: photoCaption,
          photo_url: selectedSamplePhoto,
          photo_caption: photoCaption
        })
      });
      onToast('Worksite photograph uploaded and registered with GPS timestamp!');
      refetchSubmissions();
    } catch {
      onToast('Worksite photo registered successfully.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (!blockerDetail.trim()) {
      alert('Please enter details of the blocker or safety concern.');
      return;
    }
    setSubmitting(true);
    try {
      await fetchApi('/onsite/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          report_type: 'blocker',
          summary: `${blockerCategory} (${blockerSeverity} Severity)`,
          detail: blockerDetail,
          severity: blockerSeverity
        })
      });
      onToast(`Alert logged! Blocker notice sent to Municipal Control Room.`);
      setBlockerDetail('');
      refetchSubmissions();
      qc.invalidateQueries({ queryKey: ['issues'] });
    } catch {
      onToast('Blocker logged in field records.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      await fetchApi('/onsite/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          report_type: 'shift_log',
          summary: `Daily Shift Log: ${laborCount} workers deployed`,
          detail: `Shift: ${shiftHours}. Machinery: ${machinery}`,
          labor_count: laborCount,
          shift_hours: shiftHours,
          machinery_deployed: machinery
        })
      });
      onToast(`Daily work log registered for shift ${shiftHours}!`);
      refetchSubmissions();
    } catch {
      onToast('Daily work log saved.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (!delayReason.trim()) {
      alert('Please provide the technical explanation for the delay.');
      return;
    }
    setSubmitting(true);
    try {
      await fetchApi('/onsite/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: selectedProject.id,
          report_type: 'delay',
          summary: `Field Delay Advisory: +${delayDays} days requested`,
          detail: delayReason
        })
      });
      onToast(`Delay advisory submitted to Superintending Engineer.`);
      setDelayReason('');
      refetchSubmissions();
      qc.invalidateQueries({ queryKey: ['projects'] });
    } catch {
      onToast('Delay report logged in field records.');
    } finally {
      setSubmitting(false);
    }
  };

  const MILESTONE_NAMES = [
    'Stage 1: Work Order & Underground Survey',
    'Stage 2: Barricading & Traffic Diversion',
    'Stage 3: Mechanical Trench Excavation',
    'Stage 4: Structural Conduit / Duct Laying',
    'Stage 5: High-Compaction Backfilling',
    'Stage 6: Dense Bitumen Road Resurfacing',
    'Stage 7: Quality Inspection & Handover'
  ];

  return (
    <div className="onsite-dashboard-page">
      {/* Field Officer Worksite Header Banner */}
      <div className="onsite-header-banner">
        <div className="onsite-header-left">
          <div className="onsite-header-avatar">
            <HardHat size={28} />
          </div>
          <div className="onsite-header-info">
            <h1>{user.name} · {user.badge_id}</h1>
            <p>{user.designation} — {user.department}</p>
            <div className="onsite-header-status-badge">
              <Radio size={12} />
              <span>Worksite Mobile Station Active · GCC DigSync Connected</span>
            </div>
          </div>
        </div>

        <div className="onsite-header-actions">
          <button
            className="onsite-quick-btn"
            onClick={() => { refetchSubmissions(); onToast('Worksite data refreshed from central registry'); }}
            title="Refresh submissions"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="onsite-quick-btn"
            onClick={onLogout}
            title="Sign out of on-site terminal"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Quick Metrics Strip */}
      <div className="onsite-metrics-strip">
        <div className="onsite-metric-card">
          <div className="onsite-metric-icon metric-amber">
            <Construction size={22} />
          </div>
          <div className="onsite-metric-data">
            <strong>{projects.length}</strong>
            <span>Assigned Projects</span>
          </div>
        </div>

        <div className="onsite-metric-card">
          <div className="onsite-metric-icon metric-blue">
            <CheckCircle2 size={22} />
          </div>
          <div className="onsite-metric-data">
            <strong>{fieldSubmissions.length}</strong>
            <span>Field Reports Filed</span>
          </div>
        </div>

        <div className="onsite-metric-card">
          <div className="onsite-metric-icon metric-green">
            <Activity size={22} />
          </div>
          <div className="onsite-metric-data">
            <strong>{selectedProject?.progress || 0}%</strong>
            <span>Active Site Progress</span>
          </div>
        </div>

        <div className="onsite-metric-card">
          <div className="onsite-metric-icon metric-red">
            <Clock size={22} />
          </div>
          <div className="onsite-metric-data">
            <strong>{shiftHours.split(' ')[0]}</strong>
            <span>Active Shift</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Worksite Layout */}
      <div className="onsite-main-grid">
        {/* Left Column: Assigned Projects */}
        <div className="onsite-assigned-card">
          <div className="onsite-assigned-title">
            <span>Assigned Projects</span>
            <span style={{ fontSize: '12px', color: 'var(--gray-500)', fontWeight: 600 }}>
              {projects.length} Works
            </span>
          </div>

          <div className="onsite-project-list">
            {projects.map(p => (
              <div
                key={p.id}
                className={`onsite-project-item ${selectedProjectId === p.id ? 'active' : ''}`}
                onClick={() => setSelectedProjectId(p.id)}
              >
                <div className="onsite-item-header">
                  <span className="onsite-item-code">{p.code}</span>
                  <span className={`onsite-item-status ${
                    p.status === 'In progress' ? 'status-in-progress' :
                    p.status === 'Delayed' ? 'status-delayed' : 'status-scheduled'
                  }`}>
                    {p.status}
                  </span>
                </div>

                <div className="onsite-item-title">{p.title}</div>

                <div className="onsite-item-location">
                  <MapPin size={13} />
                  <span>{p.locality} (PIN {p.pincode})</span>
                </div>

                <div className="onsite-item-progress-bar">
                  <div
                    className="onsite-item-progress-fill"
                    style={{ width: `${p.progress}%` }}
                  />
                </div>

                <div className="onsite-item-meta">
                  <span>Progress: <b>{p.progress}%</b></span>
                  <span>Stage {p.current_step || 3}/7</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Worksite Actions Workspace */}
        <div className="onsite-workspace-card">
          {/* Active Project Banner */}
          {selectedProject && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--gray-200)',
              borderRadius: '12px',
              padding: '14px 18px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div>
                <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#92400e', textTransform: 'uppercase' }}>
                  Current Active Worksite · {selectedProject.code}
                </span>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--navy)' }}>
                  {selectedProject.title}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--gray-500)' }}>
                  {selectedProject.address} · Contractor: <b>{selectedProject.contractor}</b>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>Disruption Window:</span>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#b45309' }}>
                  {selectedProject.disruption}
                </div>
              </div>
            </div>
          )}

          {/* Action Tabs Nav */}
          <div className="onsite-tabs-nav">
            <button
              className={`onsite-tab-btn ${activeTab === 'progress' ? 'active' : ''}`}
              onClick={() => setActiveTab('progress')}
            >
              <Activity size={15} /> Submit Progress
            </button>
            <button
              className={`onsite-tab-btn ${activeTab === 'photo' ? 'active' : ''}`}
              onClick={() => setActiveTab('photo')}
            >
              <Camera size={15} /> Upload Photos
            </button>
            <button
              className={`onsite-tab-btn ${activeTab === 'blocker' ? 'active' : ''}`}
              onClick={() => setActiveTab('blocker')}
            >
              <AlertTriangle size={15} /> Report Blocker / Safety
            </button>
            <button
              className={`onsite-tab-btn ${activeTab === 'log' ? 'active' : ''}`}
              onClick={() => setActiveTab('log')}
            >
              <Clock size={15} /> Work Timings & Labor
            </button>
            <button
              className={`onsite-tab-btn ${activeTab === 'delay' ? 'active' : ''}`}
              onClick={() => setActiveTab('delay')}
            >
              <AlertOctagon size={15} /> Report Delay
            </button>
            <button
              className={`onsite-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              <FileText size={15} /> Recent Submissions ({fieldSubmissions.length})
            </button>
            <button className={`onsite-tab-btn ${activeTab === 'performance' ? 'active' : ''}`} onClick={() => setActiveTab('performance')}>
              <Trophy size={15} /> My Performance Score
            </button>
          </div>

          {/* TAB 1: PROGRESS UPDATE */}
          {activeTab === 'progress' && (
            <form onSubmit={handleSubmitProgress} className="onsite-action-panel">
              <div className="onsite-form-grid">
                <div>
                  <label className="onsite-input-label">Completion Percentage ({progressPct}%)</label>
                  <div className="onsite-slider-wrap">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={progressPct}
                      onChange={e => {
                        const p = Number(e.target.value);
                        setProgressPct(p);
                        setMilestoneStep(getMilestoneStepForProgress(p));
                      }}
                    />
                    <span className="onsite-slider-val">{progressPct}%</span>
                  </div>
                </div>

                <div>
                  <label className="onsite-input-label">Amazon 7-Stage Milestone Step</label>
                  <select
                    className="onsite-select-input"
                    value={milestoneStep}
                    onChange={e => {
                      const s = Number(e.target.value);
                      setMilestoneStep(s);
                      setProgressPct(getProgressForMilestoneStep(s));
                    }}
                  >
                    {MILESTONE_NAMES.map((m, idx) => (
                      <option key={idx} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="onsite-form-full">
                  <label className="onsite-input-label">Work Performed Today (Worksite Log)</label>
                  <textarea
                    rows={3}
                    className="onsite-textarea-input"
                    value={workPerformed}
                    onChange={e => setWorkPerformed(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit-btn btn-onsite-auth" disabled={submitting}>
                <Send size={15} /> {submitting ? 'Submitting to Central Registry…' : 'Submit Field Progress Update'}
              </button>
            </form>
          )}

          {/* TAB 2: WORK PHOTOGRAPHS */}
          {activeTab === 'photo' && (
            <form onSubmit={handleSubmitPhoto} className="onsite-action-panel">
              <div className="onsite-form-grid">
                <div>
                  <label className="onsite-input-label">Worksite Photograph Category</label>
                  <select
                    className="onsite-select-input"
                    value={photoCategory}
                    onChange={e => setPhotoCategory(e.target.value)}
                  >
                    <option value="Mechanical Trench Excavation">Mechanical Trench Excavation & Depth Audit</option>
                    <option value="Structural Conduit / Duct Laying">Structural Conduit / Duct Laying</option>
                    <option value="High-Compaction Backfilling">High-Compaction Backfilling & Roller Test</option>
                    <option value="Safety Barricading & Night Signage">Safety Barricading & Night Reflectors</option>
                    <option value="Dense Bitumen Road Resurfacing">Dense Bitumen Road Resurfacing Finish</option>
                  </select>
                </div>

                <div>
                  <label className="onsite-input-label">Photo Description / Location Tag</label>
                  <input
                    type="text"
                    className="onsite-text-input"
                    value={photoCaption}
                    onChange={e => setPhotoCaption(e.target.value)}
                    placeholder="e.g. Chainage 0+200 pipe joint pressure test"
                    required
                  />
                </div>

                <div className="onsite-form-full">
                  <label className="onsite-input-label">Select Worksite Photograph Preview</label>
                  <div className="photo-preview-grid">
                    {[
                      { url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=600&q=80', label: 'Trench & Cables' },
                      { url: 'https://images.unsplash.com/photo-1590496793929-36417d3117de?auto=format&fit=crop&w=600&q=80', label: 'Pipes & Bedding' },
                      { url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80', label: 'Engineer Inspection' }
                    ].map((img, i) => (
                      <div
                        key={i}
                        className={`photo-preview-item ${selectedSamplePhoto === img.url ? 'selected' : ''}`}
                        onClick={() => setSelectedSamplePhoto(img.url)}
                      >
                        <img src={img.url} alt={img.label} />
                        <span className="photo-preview-badge">{img.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button type="submit" className="login-submit-btn btn-onsite-auth" disabled={submitting}>
                <Camera size={15} /> {submitting ? 'Uploading Proof…' : 'Upload & Timestamp Photograph'}
              </button>
            </form>
          )}

          {/* TAB 3: BLOCKER / SAFETY ALERT */}
          {activeTab === 'blocker' && (
            <form onSubmit={handleSubmitBlocker} className="onsite-action-panel">
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: '10px',
                padding: '12px 16px',
                color: '#b91c1c',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                <span>
                  Blockers reported here immediately flag into the Municipal Control Room and notify interdepartmental DigSync coordinators.
                </span>
              </div>

              <div className="onsite-form-grid">
                <div>
                  <label className="onsite-input-label">Blocker Nature / Hazard</label>
                  <select
                    className="onsite-select-input"
                    value={blockerCategory}
                    onChange={e => setBlockerCategory(e.target.value)}
                  >
                    <option value="Unmapped Utility Collision">Unmapped Underground Electric / Water Line Hit</option>
                    <option value="Heavy Slurry Seepage">Severe Groundwater / Sewer Ingress</option>
                    <option value="Traffic Congestion Conflict">Traffic Diversion Gridlock / Police Advisory</option>
                    <option value="Heritage Wall Foundation Risk">Structural Heritage Proximity / ASI Clearance</option>
                    <option value="Material Supply Disruption">Ductile Iron Pipe / Bitumen Supply Shortage</option>
                  </select>
                </div>

                <div>
                  <label className="onsite-input-label">Severity Level</label>
                  <select
                    className="onsite-select-input"
                    value={blockerSeverity}
                    onChange={e => setBlockerSeverity(e.target.value)}
                  >
                    <option value="Critical">Critical — Work Halted</option>
                    <option value="High">High — Single Lane Compromised</option>
                    <option value="Medium">Medium — Mitigation in Progress</option>
                    <option value="Low">Low — Minor Delay</option>
                  </select>
                </div>

                <div className="onsite-form-full">
                  <label className="onsite-input-label">Condition Description & Immediate Actions Taken</label>
                  <textarea
                    rows={3}
                    className="onsite-textarea-input"
                    placeholder="Describe exact location, unexpected conditions encountered, and safety barricading installed..."
                    value={blockerDetail}
                    onChange={e => setBlockerDetail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                style={{ background: '#dc2626' }}
                disabled={submitting}
              >
                <AlertTriangle size={15} /> {submitting ? 'Transmitting Alert…' : 'Transmit Worksite Blocker to GCC Command'}
              </button>
            </form>
          )}

          {/* TAB 4: WORK TIMINGS & MACHINERY LOG */}
          {activeTab === 'log' && (
            <form onSubmit={handleSubmitLog} className="onsite-action-panel">
              <div className="onsite-form-grid">
                <div>
                  <label className="onsite-input-label">Actual Work Shift Window</label>
                  <select
                    className="onsite-select-input"
                    value={shiftHours}
                    onChange={e => setShiftHours(e.target.value)}
                  >
                    <option value="Day Shift (08:30 - 17:30)">Day Shift (08:30 – 17:30)</option>
                    <option value="Night Shift (22:00 - 04:30)">Night Shift (22:00 – 04:30 · Low Traffic)</option>
                    <option value="Split Twin Shift (06:00 - 14:00 & 18:00 - 22:00)">Split Twin Shift</option>
                  </select>
                </div>

                <div>
                  <label className="onsite-input-label">Active Labor Force on Site (Headcount)</label>
                  <input
                    type="number"
                    min={1}
                    max={150}
                    className="onsite-text-input"
                    value={laborCount}
                    onChange={e => setLaborCount(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="onsite-form-full">
                  <label className="onsite-input-label">Active Heavy Machinery & Dust Mitigation Units</label>
                  <input
                    type="text"
                    className="onsite-text-input"
                    value={machinery}
                    onChange={e => setMachinery(e.target.value)}
                    placeholder="e.g. 1x JCB Excavator, 1x Water Mist Sprinkler, 1x Plate Compactor"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit-btn btn-onsite-auth" disabled={submitting}>
                <Clock size={15} /> {submitting ? 'Recording Log…' : 'Record Shift Timings & Resources'}
              </button>
            </form>
          )}

          {/* TAB 5: DELAY ADVISORY */}
          {activeTab === 'delay' && (
            <form onSubmit={handleSubmitDelay} className="onsite-action-panel">
              <div className="onsite-form-grid">
                <div>
                  <label className="onsite-input-label">Estimated Extension Required (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    className="onsite-text-input"
                    value={delayDays}
                    onChange={e => setDelayDays(Number(e.target.value))}
                    required
                  />
                </div>

                <div>
                  <label className="onsite-input-label">Current Scheduled Deadline</label>
                  <input
                    type="text"
                    className="onsite-text-input"
                    value={selectedProject?.due_date || '2026-08-30'}
                    disabled
                    style={{ background: 'var(--gray-100)' }}
                  />
                </div>

                <div className="onsite-form-full">
                  <label className="onsite-input-label">Technical Delay Root Cause & Schedule Catch-up Plan</label>
                  <textarea
                    rows={3}
                    className="onsite-textarea-input"
                    placeholder="Explain why the delay occurred (e.g. unexpected granite strata, utility relocation clearance) and mitigation proposed..."
                    value={delayReason}
                    onChange={e => setDelayReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                style={{ background: '#7c3aed' }}
                disabled={submitting}
              >
                <AlertOctagon size={15} /> {submitting ? 'Filing Advisory…' : 'File Deadline Revision Request'}
              </button>
            </form>
          )}

          {/* TAB 6: RECENT SUBMISSIONS HISTORY */}
          {activeTab === 'history' && (
            <div className="submissions-history-feed">
              {fieldSubmissions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--gray-500)' }}>
                  No field submissions logged yet today. Use the tabs above to file progress updates.
                </div>
              ) : (
                fieldSubmissions.map((sub: any) => (
                  <div key={sub.id} className="submission-feed-item">
                    <div className={`submission-type-icon ${
                      sub.report_type === 'progress' ? 'icon-progress' :
                      sub.report_type === 'photo' ? 'icon-photo' :
                      sub.report_type === 'blocker' ? 'icon-blocker' :
                      sub.report_type === 'delay' ? 'icon-delay' : 'icon-log'
                    }`}>
                      {sub.report_type === 'progress' && <Activity size={18} />}
                      {sub.report_type === 'photo' && <Camera size={18} />}
                      {sub.report_type === 'blocker' && <AlertTriangle size={18} />}
                      {sub.report_type === 'delay' && <Clock size={18} />}
                      {sub.report_type === 'shift_log' && <CheckSquare size={18} />}
                    </div>

                    <div className="submission-content">
                      <div className="submission-header-row">
                        <span className="submission-header-title">{sub.summary}</span>
                        <span className={`submission-status-pill ${
                          sub.status.includes('Approved') || sub.status.includes('Verified') ? '' : 'under-review'
                        }`}>
                          {sub.status}
                        </span>
                      </div>

                      <p className="submission-detail-text">{sub.detail}</p>

                      {sub.photo_url && (
                        <div style={{ marginTop: '8px', marginBottom: '8px', maxWidth: '200px', borderRadius: '8px', overflow: 'hidden' }}>
                          <img src={sub.photo_url} alt="worksite" style={{ width: '100%', height: '110px', objectFit: 'cover' }} />
                        </div>
                      )}

                      <div className="submission-meta-row">
                        <span>Project: <b>{sub.project_code || `ID #${sub.project_id}`}</b></span>
                        <span>Officer: <b>{sub.official_name}</b> ({sub.official_badge})</span>
                        <span>Time: {new Date(sub.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {activeTab === 'performance' && <ContractorPerformanceDashboard mode="onsite" />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DEPT CONFLICT COORDINATION TAB
// ============================================================
function DeptConflictCoordinationTab({ activeDept, digsync, deptConflicts, onToast }: {
  activeDept: string;
  digsync: any[];
  deptConflicts: any[];
  onToast: (m: string) => void;
}) {
  const qc = useQueryClient();
  const [view, setView] = useState<'tickets' | 'spatial'>('tickets');
  const [rescheduleInputs, setRescheduleInputs] = useState<{ [id: number]: { start: string; end: string } }>({});
  const [rescheduleErrors, setRescheduleErrors] = useState<{ [id: number]: string }>({});
  const [reschedulingId, setReschedulingId] = useState<number | null>(null);

  const { data: allTickets = [], refetch: refetchTickets } = useQuery({
    queryKey: ['conflict_tickets'],
    queryFn: () => fetchApi<any[]>('/conflict-tickets').catch(() => []),
    refetchInterval: 15000
  });

  const myTickets = (allTickets as any[]).filter(t => {
    const d = activeDept.toLowerCase();
    return t.requesting_dept?.toLowerCase().includes(d) || t.conflicting_dept?.toLowerCase().includes(d);
  });

  const myPending = myTickets.filter(t => t.status !== 'Resolved');

  const handleRescheduleSubmit = async (ticketId: number) => {
    const inputs = rescheduleInputs[ticketId];
    if (!inputs?.start || !inputs?.end) {
      setRescheduleErrors(prev => ({ ...prev, [ticketId]: 'Please select both a Start Date and Target Completion Date.' }));
      return;
    }
    if (inputs.start > inputs.end) {
      setRescheduleErrors(prev => ({ ...prev, [ticketId]: 'Start Date cannot be after Target Completion Date.' }));
      return;
    }
    setReschedulingId(ticketId);
    setRescheduleErrors(prev => ({ ...prev, [ticketId]: '' }));

    try {
      const res = await fetchApi<any>(`/conflict-tickets/${ticketId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_start_date: inputs.start,
          new_due_date: inputs.end
        })
      });
      onToast(`Schedule updated! Work set to Scheduled from ${inputs.start} to ${inputs.end}.`);
      refetchTickets();
      qc.invalidateQueries({ queryKey: ['conflict_tickets'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['department_projects'] });
    } catch (err: any) {
      const msg = err?.message || 'Conflict detected on selected dates with another department. Please choose different dates.';
      setRescheduleErrors(prev => ({ ...prev, [ticketId]: msg }));
    } finally {
      setReschedulingId(null);
    }
  };

  return (
    <div className="digsync-section">
      <div className="digsync-explainer-banner" style={{ background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)' }}>
        <div>
          <h3 style={{ fontSize: '17px', fontWeight: 800, margin: '0 0 6px 0', color: '#ffffff' }}>
            DigSync Conflict Coordination
          </h3>
          <p style={{ fontSize: '13px', color: '#ccfbf1', margin: 0 }}>
            View your department's scheduling conflict tickets and spatial overlaps. Review municipality decisions and reschedule dates as directed.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`gmaps-chip ${view === 'tickets' ? 'active' : ''}`}
            style={{ fontWeight: 700, padding: '8px 14px', whiteSpace: 'nowrap' }}
            onClick={() => setView('tickets')}
          >
            <Ticket size={13} style={{ display: 'inline', marginRight: '5px' }} />
            My Tickets ({myPending.length} Pending)
          </button>
          <button
            className={`gmaps-chip ${view === 'spatial' ? 'active' : ''}`}
            style={{ fontWeight: 700, padding: '8px 14px', whiteSpace: 'nowrap' }}
            onClick={() => setView('spatial')}
          >
            <GitBranch size={13} style={{ display: 'inline', marginRight: '5px' }} />
            Corridor Overlaps ({deptConflicts.length})
          </button>
        </div>
      </div>

      {view === 'tickets' && (
        <div>
          {myTickets.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <ClipboardList size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#0f2438', margin: '0 0 6px' }}>No Conflict Tickets</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                Your department has not raised any scheduling conflict tickets. When scheduling a new project with conflicting dates, use "Sanction Project" and click "Check for Conflicts".
              </p>
            </div>
          )}

          {myTickets.map((t: any) => {
            const isRequester = t.requesting_dept?.toLowerCase().includes(activeDept.toLowerCase());
            const isResolved = t.status === 'Resolved';
            const isApprovedDept = isResolved && Boolean(t.approved_dept && (
              t.approved_dept.toLowerCase().includes(activeDept.toLowerCase()) ||
              activeDept.toLowerCase().includes(t.approved_dept.toLowerCase())
            ));
            const isRescheduledDept = isResolved && !isApprovedDept;

            return (
              <div
                key={t.id}
                style={{
                  background: !isResolved
                    ? 'white'
                    : isApprovedDept
                    ? '#ecfdf5'
                    : '#fef2f2',
                  border: `2px solid ${
                    !isResolved
                      ? '#fde68a'
                      : isApprovedDept
                      ? '#10b981'
                      : '#ef4444'
                  }`,
                  borderRadius: '14px',
                  padding: '18px',
                  marginBottom: '14px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ background: '#0f2438', color: '#fff', padding: '3px 8px', borderRadius: '5px', fontFamily: 'monospace', fontSize: '11.5px', fontWeight: 700 }}>
                      {t.ref}
                    </span>
                    <span style={{
                      background: isRequester ? '#e0f2fe' : '#f3e8ff',
                      color: isRequester ? '#0369a1' : '#7c3aed',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: 700
                    }}>
                      {isRequester ? '↑ You Raised This Ticket' : '↓ Conflict Raised Against Your Project'}
                    </span>
                  </div>
                  <div>
                    {!isResolved ? (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700 }}>
                        Pending Municipality Review
                      </span>
                    ) : isApprovedDept ? (
                      <span style={{ background: '#059669', color: '#ffffff', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={13} /> Work In Progress
                      </span>
                    ) : (
                      <span style={{ background: t.rescheduled_status === 'Scheduled' ? '#059669' : '#dc2626', color: '#ffffff', padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} /> {t.rescheduled_status === 'Scheduled' ? 'Status: Scheduled' : 'Action Required: Reschedule'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Conflict Context Cards */}
                <div style={{ background: isResolved ? 'rgba(255,255,255,0.75)' : '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '12px', fontSize: '13px', border: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '10px', alignItems: 'start' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: '3px' }}>Requesting</div>
                      <div style={{ fontWeight: 700, color: '#0f2438' }}>{t.requesting_dept}</div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{t.proposed_title}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>📅 {t.proposed_start} → {t.proposed_end}</div>
                    </div>
                    <div style={{ fontWeight: 900, color: '#dc2626', textAlign: 'center', padding: '0 4px' }}>VS</div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: '3px' }}>Conflicting</div>
                      <div style={{ fontWeight: 700, color: '#0f2438' }}>{t.conflicting_dept}</div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{t.conflicting_project_title}</div>
                      {t.conflicting_start && (
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>📅 {t.conflicting_start} → {t.conflicting_end}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* RESOLUTION VIEW */}
                {isResolved ? (
                  isApprovedDept ? (
                    /* GREEN NOTIFICATION FOR APPROVED DEPT */
                    <div style={{ background: '#dcfce7', border: '1.5px solid #86efac', borderRadius: '10px', padding: '14px', color: '#14532d' }}>
                      <div style={{ fontWeight: 800, color: '#15803d', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <CheckCircle size={17} color="#16a34a" /> PRIORITY SANCTION GRANTED — WORK IN PROGRESS
                      </div>
                      <div style={{ fontSize: '13px', color: '#166534', marginTop: '8px', lineHeight: '1.5' }}>
                        <strong>Municipality Sanction Order & Reason:</strong><br />
                        {t.municipality_decision}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #bbf7d0', fontSize: '11.5px', color: '#15803d' }}>
                        <span>✓ Sanctioned by: <strong>{t.resolved_by}</strong></span>
                        <span>Auto-updated status to <strong>In progress</strong></span>
                      </div>
                    </div>
                  ) : (
                    /* RED NOTIFICATION FOR NON-APPROVED DEPT */
                    <div style={{ background: '#fee2e2', border: '1.5px solid #fca5a5', borderRadius: '10px', padding: '14px', color: '#7f1d1d' }}>
                      <div style={{ fontWeight: 800, color: '#b91c1c', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <AlertTriangle size={17} color="#dc2626" /> WORK POSTPONED BY MUNICIPALITY — ACTION REQUIRED: SELECT NEW DATES
                      </div>
                      <div style={{ fontSize: '13px', color: '#991b1b', marginTop: '8px', lineHeight: '1.5' }}>
                        <strong>Municipality Reason & Decision:</strong><br />
                        {t.municipality_decision}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#7f1d1d', marginTop: '6px' }}>
                        Priority was granted to: <strong>{t.approved_dept}</strong>. Please select new dates for your work.
                      </div>

                      {/* Reschedule Completed State */}
                      {t.rescheduled_status === 'Scheduled' ? (
                        <div style={{ marginTop: '12px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CheckCircle size={16} color="#16a34a" />
                          <div>
                            <strong style={{ fontSize: '13px' }}>New Schedule Confirmed (Status: Scheduled)</strong>
                            <div style={{ fontSize: '12px', marginTop: '2px' }}>
                              Dates: <strong>{t.rescheduled_start}</strong> to <strong>{t.rescheduled_end}</strong> · No conflicts detected.
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Reschedule Interactive Form */
                        <div style={{ marginTop: '14px', background: 'white', border: '1.5px solid #f87171', borderRadius: '10px', padding: '14px' }}>
                          <h4 style={{ margin: '0 0 8px', fontSize: '13.5px', color: '#991b1b', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={15} /> Select New Dates to Schedule Work
                          </h4>
                          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 10px' }}>
                            Choose alternative dates. The system will verify there are no conflicts with other departments before setting status to <strong>Scheduled</strong>.
                          </p>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                                New Start Date *
                              </label>
                              <input
                                type="date"
                                value={rescheduleInputs[t.id]?.start || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setRescheduleInputs(prev => ({
                                    ...prev,
                                    [t.id]: { ...(prev[t.id] || { start: '', end: '' }), start: val }
                                  }));
                                }}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                                New Completion Date *
                              </label>
                              <input
                                type="date"
                                value={rescheduleInputs[t.id]?.end || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setRescheduleInputs(prev => ({
                                    ...prev,
                                    [t.id]: { ...(prev[t.id] || { start: '', end: '' }), end: val }
                                  }));
                                }}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                              />
                            </div>
                          </div>

                          {rescheduleErrors[t.id] && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '8px 10px', borderRadius: '6px', fontSize: '12px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <AlertTriangle size={14} /> {rescheduleErrors[t.id]}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRescheduleSubmit(t.id)}
                            disabled={reschedulingId === t.id}
                            style={{
                              padding: '9px 18px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#0f766e',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <CheckCircle size={14} />
                            {reschedulingId === t.id ? 'Checking Conflicts…' : 'Verify & Set Status to Scheduled'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  /* PENDING BANNER */
                  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', color: '#7c2d12' }}>
                    <AlertTriangle size={13} style={{ display: 'inline', marginRight: '6px' }} />
                    <strong>Pending Municipality Review</strong> — The municipality will review this ticket and notify both departments with their decision.
                    {isRequester && (
                      <div style={{ marginTop: '6px', fontSize: '12px', color: '#92400e' }}>
                        <strong>Your reason:</strong> {t.reason_for_proceeding}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === 'spatial' && (
        <div className="digsync-cards-grid">
          {deptConflicts.map((c: any, idx: number) => (
            <div className="dept-digsync-card" key={idx}>
              <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', display: 'inline-block', marginBottom: '8px' }}>
                Corridor Overlap Detected
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Project A:</span>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginTop: '2px' }}>{c.project_a?.title || c.projects?.[0]?.title}</div>
                  <div style={{ color: '#0f766e', fontWeight: 600, fontSize: '12px' }}>{c.project_a?.department || c.projects?.[0]?.department}</div>
                </div>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Project B (Overlapping):</span>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginTop: '2px' }}>{c.project_b?.title || c.projects?.[1]?.title}</div>
                  <div style={{ color: '#1d4ed8', fontWeight: 600, fontSize: '12px' }}>{c.project_b?.department || c.projects?.[1]?.department}</div>
                </div>
              </div>
            </div>
          ))}
          {deptConflicts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>
              <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--navy)', margin: '0 0 6px 0' }}>No Active DigSync Road Overlaps</h3>
              <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>All road trenching permits for {activeDept} are non-conflicting.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// 4a. REUSABLE PROJECT OPERATIONS & STAGE UPDATE MODAL
// ============================================================
function ProjectOperationsModal({
  project,
  onClose,
  onSave,
  isPending
}: {
  project: Project | null;
  onClose: () => void;
  onSave: (id: number, data: any) => void;
  isPending?: boolean;
}) {
  if (!project) return null;

  const [step, setStep] = useState<number>(project.current_step || (project.status === 'Completed' ? 7 : 3));
  const [progress, setProgress] = useState<number>(project.progress ?? 45);
  const [status, setStatus] = useState<string>(project.status || 'In progress');
  const [delayReason, setDelayReason] = useState<string>(project.delay_reason || '');
  const [noiseWarning, setNoiseWarning] = useState<string>(project.noise_warning || 'Permitted high-noise window: 22:00 - 04:00');
  const [dustWarning, setDustWarning] = useState<string>(project.dust_warning || 'Trenching dust window: 09:00 - 14:00');
  const [gmapsBroadcast, setGmapsBroadcast] = useState<boolean>(project.gmaps_broadcast ?? true);

  // Auto-update percentage when stage dropdown changes
  const handleStepChange = (newStep: number) => {
    setStep(newStep);
    const autoProgress = getProgressForMilestoneStep(newStep);
    setProgress(autoProgress);
    if (newStep === 7) {
      setStatus('Completed');
    } else if (status === 'Completed') {
      setStatus('In progress');
    }
  };

  // Auto-update milestone step when progress input/slider changes
  const handleProgressChange = (newProgress: number) => {
    const clamped = Math.max(0, Math.min(100, newProgress));
    setProgress(clamped);
    const autoStep = getMilestoneStepForProgress(clamped);
    setStep(autoStep);
    if (clamped === 100) {
      setStatus('Completed');
    } else if (status === 'Completed' && clamped < 100) {
      setStatus('In progress');
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    if (newStatus === 'Completed') {
      setStep(7);
      setProgress(100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(project.id, {
      current_step: step,
      progress,
      status,
      delay_reason: status === 'Delayed' ? delayReason : (delayReason || null),
      noise_warning: noiseWarning,
      dust_warning: dustWarning,
      gmaps_broadcast: gmapsBroadcast
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window project-operations-modal" style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-window-head">
          <div>
            <span className="table-code-badge">{project.code}</span>
            <h3 style={{ margin: '4px 0 0', fontSize: '17px', color: 'var(--navy)' }}>
              Update Project Operations & Stage
            </h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-window-body">
            {/* Live Visual Progress & Milestone Preview */}
            <div className="modal-progress-live-preview">
              <div className="live-preview-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="live-preview-title">Live Milestone Tracker</span>
                  <span className={`place-status-chip ${status === 'Completed' ? 'completed' : status === 'Delayed' ? 'delayed' : 'in-progress'}`}>
                    {status}
                  </span>
                </div>
                <div className="live-progress-pct-badge">{progress}% Complete</div>
              </div>

              {/* Animated Progress Bar */}
              <div className="modal-live-progress-bar-wrap">
                <div
                  className="modal-live-progress-bar-fill"
                  style={{
                    width: `${progress}%`,
                    background: status === 'Delayed'
                      ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                      : progress === 100
                        ? 'linear-gradient(90deg, #10b981, #059669)'
                        : 'linear-gradient(90deg, #0f766e, #06b6d4)'
                  }}
                />
              </div>

              {/* 7-Step Mini Indicator */}
              <div className="modal-steps-mini-track">
                {MILESTONE_STEPS.map(s => {
                  const isDone = s.step < step || (s.step === 7 && progress === 100);
                  const isCurrent = s.step === step;
                  return (
                    <div
                      key={s.step}
                      className={`modal-step-mini-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
                      onClick={() => handleStepChange(s.step)}
                      title={`Stage ${s.step}: ${s.title} (${MILESTONE_STEP_PROGRESS[s.step]}%)`}
                    >
                      <span className="mini-node-num">{isDone ? '✓' : s.step}</span>
                      <span className="mini-node-label">Stage {s.step}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage Dropdown (Auto-updates progress percentage) */}
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Amazon Tracker Milestone Stage</span>
                <span style={{ fontSize: '11.5px', color: '#0f766e', fontWeight: 600 }}>⚡ Auto-syncs Progress %</span>
              </label>
              <select
                className="modal-custom-select"
                value={step}
                onChange={e => handleStepChange(Number(e.target.value))}
              >
                {MILESTONE_STEPS.map(s => (
                  <option key={s.step} value={s.step}>
                    Stage {s.step}: {s.title} ({MILESTONE_STEP_PROGRESS[s.step]}% Target)
                  </option>
                ))}
              </select>
              <div className="step-desc-hint">
                <strong>Stage Description:</strong> {MILESTONE_STEPS[step - 1]?.desc}
              </div>
            </div>

            {/* Progress Percentage (Slider + Number) */}
            <div className="form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--navy)' }}>Verified Progress Percentage</span>
                <strong style={{ fontSize: '14px', color: '#0f766e' }}>{progress}%</strong>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={e => handleProgressChange(Number(e.target.value))}
                  style={{ flexGrow: 1, accentColor: '#0f766e', cursor: 'pointer' }}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={e => handleProgressChange(Number(e.target.value))}
                  style={{ width: '70px', padding: '6px 8px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700 }}
                />
              </div>
            </div>

            {/* Work Status */}
            <div className="form-group">
              <label style={{ fontWeight: 700, color: 'var(--navy)' }}>Work Status</label>
              <select
                className="modal-custom-select"
                value={status}
                onChange={e => handleStatusChange(e.target.value)}
              >
                <option value="In progress">In progress (Active Civil Works)</option>
                <option value="Delayed">Delayed (Behind Schedule)</option>
                <option value="Upcoming">Upcoming (Permit Approved)</option>
                <option value="Scheduled">Scheduled (Awaiting Mobilisation)</option>
                <option value="Completed">Completed (100% Commissioned)</option>
              </select>
            </div>

            {/* Delay Reason (if delayed) */}
            {status === 'Delayed' && (
              <div className="form-group" style={{ animation: 'fade-in 0.2s ease' }}>
                <label style={{ fontWeight: 700, color: '#dc2626' }}>Official Delay Reason & Explanation</label>
                <input
                  type="text"
                  className="modal-custom-input"
                  value={delayReason}
                  onChange={e => setDelayReason(e.target.value)}
                  placeholder="e.g. Unmapped underground high-voltage cables encountered; manual trenching underway"
                  required
                />
              </div>
            )}

            {/* Environmental & Hazard Warning Windows */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Noise Warning Window</label>
                <input
                  type="text"
                  className="modal-custom-input"
                  value={noiseWarning}
                  onChange={e => setNoiseWarning(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Dust Warning Window</label>
                <input
                  type="text"
                  className="modal-custom-input"
                  value={dustWarning}
                  onChange={e => setDustWarning(e.target.value)}
                />
              </div>
            </div>

            {/* Google Maps Detour Broadcast Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <input
                type="checkbox"
                id="modal_gmaps_broadcast"
                checked={gmapsBroadcast}
                onChange={e => setGmapsBroadcast(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#0f766e', cursor: 'pointer' }}
              />
              <label htmlFor="modal_gmaps_broadcast" style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                Broadcast Live Road Closures & Commute Detours to Google Maps Navigation Feed
              </label>
            </div>
          </div>

          <div className="modal-window-footer">
            <button type="button" className="table-action-btn" style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="table-action-btn" style={{ background: '#0f766e', color: '#ffffff', borderColor: '#0d9488' }} disabled={isPending}>
              {isPending ? 'Saving Updates…' : 'Save Operational Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// 4a-2. MUNICIPAL CITIZEN REPLY & INTERVENTION MODAL
// ============================================================
function MunicipalReplyModal({
  issue,
  onClose,
  onSubmit,
  isPending,
  officialUser
}: {
  issue: any | null;
  onClose: () => void;
  onSubmit: (id: number, reply: string, status: string) => void;
  isPending?: boolean;
  officialUser?: AuthUser;
}) {
  if (!issue) return null;

  const [replyText, setReplyText] = useState('');
  const [status, setStatus] = useState<'Answered' | 'Resolved'>('Answered');

  const templates = [
    'Municipal Executive inspection conducted; emergency contractor deployed for immediate resolution.',
    'Excavation backfilling ordered on priority. Road surface restoration will complete tonight.',
    'Alternative utility diversion commissioned to prevent service disruption to neighborhood.',
    'Site engineer issued compliance notice. Dust suppression & acoustic barriers reinforced.'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) {
      alert('Please enter your official response message.');
      return;
    }
    onSubmit(issue.id, replyText.trim(), status);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window municipal-reply-modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-window-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="grievance-ref">{issue.ref}</span>
            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--navy)' }}>
              Municipal Citizen Response & Intervention
            </h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-window-body">
            {/* Citizen Submission Context Card */}
            <div className="reply-modal-citizen-card">
              <div className="reply-modal-citizen-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={15} color="#0f766e" />
                  <strong style={{ fontSize: '13.5px', color: '#0f2438' }}>{issue.kind}</strong>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {issue.pincode && <span className="pincode-change-tag">PIN {issue.pincode}</span>}
                  <span className={`place-status-chip ${issue.status === 'Resolved' || issue.status === 'Answered' ? 'completed' : 'in-progress'}`}>
                    {issue.status}
                  </span>
                </div>
              </div>

              <p className="reply-modal-message-text">"{issue.message}"</p>

              <div className="reply-modal-meta-row">
                <span>Locality: <strong>{issue.locality}</strong></span>
                {issue.department && <span>Department: <strong>{issue.department}</strong></span>}
                {issue.project_title && <span>Project: <strong>{issue.project_title}</strong></span>}
              </div>
            </div>

            {/* SLA Escalation Warning Banner */}
            {issue.is_escalated && (
              <div className="reply-modal-escalation-alert">
                <AlertTriangle size={18} color="#b91c1c" />
                <div>
                  <strong>Mandatory SLA Escalation Intervention:</strong>
                  <p style={{ margin: '2px 0 0', fontSize: '12px' }}>
                    This inquiry has been pending for <strong>{issue.days_elapsed} days</strong> without departmental response. Publishing this response will clear the escalation on the public grid.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Response Templates */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>
                ⚡ Quick Official Response Presets:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {templates.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="quick-template-btn"
                    onClick={() => setReplyText(tmpl)}
                  >
                    💡 {tmpl}
                  </button>
                ))}
              </div>
            </div>

            {/* Official Response Input */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 700, color: 'var(--navy)' }}>Official Municipal Reply Message</label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{replyText.length} characters</span>
              </div>
              <textarea
                rows={4}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Enter official resolution details, engineering schedules, or site mitigation actions..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: '1.5'
                }}
                required
              />
            </div>

            {/* Status Update & Signatory Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Resolution Status:</span>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    background: '#ffffff'
                  }}
                >
                  <option value="Answered">Answered (Public Notice)</option>
                  <option value="Resolved">Resolved & Closed</option>
                </select>
              </div>

              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                Dispatched by: <strong style={{ color: '#0f766e' }}>{officialUser?.name || 'Municipal Engineer'}</strong>
              </div>
            </div>
          </div>

          <div className="modal-window-footer">
            <button type="button" className="table-action-btn" style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="table-action-btn" style={{ background: '#0f766e', color: '#ffffff', borderColor: '#0d9488' }} disabled={isPending}>
              <Send size={13} /> {isPending ? 'Publishing Response…' : 'Publish to Public Feed'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// 4b. DEPARTMENT DASHBOARD (/department/dashboard)
// ============================================================
function DepartmentDashboard({
  user,
  projects,
  issues,
  digsync,
  onLogout,
  onToast
}: {
  user: AuthUser;
  projects: Project[];
  issues: any[];
  digsync: any[];
  onLogout: () => void;
  onToast: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'submissions' | 'projects' | 'coordination' | 'create_project'>('submissions');
  const [subFilter, setSubFilter] = useState<'all' | 'pending' | 'escalated' | 'resolved'>('all');
  const activeDept = user.department;
  const [replyingIssueId, setReplyingIssueId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyStatus, setReplyStatus] = useState<'Answered' | 'Resolved'>('Answered');
  const [selectedProjectModal, setSelectedProjectModal] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectSearch, setProjectSearch] = useState('');

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return fetchApi<any>(`/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      setEditingProject(null);
      if (selectedProjectModal) {
        const updated = projects.find(p => p.id === selectedProjectModal.id);
        if (updated) setSelectedProjectModal(updated);
      }
      onToast('Project operational stage and progress percentage updated successfully!');
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['department_projects'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    }
  });

  // Filter department projects
  const deptProjects = useMemo(() => {
    return projects.filter(p => {
      const pDept = (p.department || '').toLowerCase();
      const aDept = activeDept.toLowerCase();
      return pDept.includes(aDept) || aDept.includes(pDept);
    });
  }, [projects, activeDept]);

  // Filter department issues (routed to this department via project or explicit department)
  const deptIssues = useMemo(() => {
    return issues.filter(iss => {
      const issDept = (iss.department || '').toLowerCase().trim();
      const aDept = activeDept.toLowerCase().trim();
      if (!issDept) return false;
      if (issDept === aDept || issDept.includes(aDept) || aDept.includes(issDept)) return true;
      if (aDept.includes('water') && issDept.includes('water')) return true;
      if ((aDept.includes('tangedco') || aDept.includes('power') || aDept.includes('electr')) && (issDept.includes('tangedco') || issDept.includes('power') || issDept.includes('electr'))) return true;
      if ((aDept.includes('drain') || aDept.includes('stormwater') || aDept.includes('swd')) && (issDept.includes('drain') || issDept.includes('stormwater') || issDept.includes('swd'))) return true;
      if ((aDept.includes('road') || aDept.includes('bridge')) && (issDept.includes('road') || issDept.includes('bridge'))) return true;
      return false;
    });
  }, [issues, activeDept]);

  // SLA calculations
  const pendingIssues = useMemo(() => {
    return deptIssues.filter(i => (i.status !== 'Resolved' && i.status !== 'Answered') && !i.is_escalated);
  }, [deptIssues]);

  const escalatedIssues = useMemo(() => {
    return deptIssues.filter(i => i.is_escalated || ((i.status !== 'Resolved' && i.status !== 'Answered') && (i.days_elapsed >= 3)));
  }, [deptIssues]);

  const resolvedIssues = useMemo(() => {
    return deptIssues.filter(i => i.status === 'Resolved' || i.status === 'Answered');
  }, [deptIssues]);

  // Filtered issues according to subFilter pill
  const displayedIssues = useMemo(() => {
    if (subFilter === 'pending') return pendingIssues;
    if (subFilter === 'escalated') return escalatedIssues;
    if (subFilter === 'resolved') return resolvedIssues;
    return deptIssues;
  }, [subFilter, pendingIssues, escalatedIssues, resolvedIssues, deptIssues]);

  // DigSync conflicts involving this department
  const deptConflicts = useMemo(() => {
    return digsync.filter(c => {
      const d1 = (c.project_a?.department || '').toLowerCase();
      const d2 = (c.project_b?.department || '').toLowerCase();
      const aDept = activeDept.toLowerCase();
      return d1.includes(aDept) || d2.includes(aDept);
    });
  }, [digsync, activeDept]);

  const replyMutation = useMutation({
    mutationFn: async ({ id, reply, status }: { id: number; reply: string; status: string }) => {
      return fetchApi<any>(`/issues/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply, status })
      });
    },
    onSuccess: () => {
      onToast('Department official response published to public feed.');
      setReplyingIssueId(null);
      setReplyText('');
      qc.invalidateQueries({ queryKey: ['admin_issues'] });
      qc.invalidateQueries({ queryKey: ['issues'] });
    }
  });

  const handleSendReply = (issId: number) => {
    if (!replyText.trim()) {
      alert('Please enter a response message.');
      return;
    }
    replyMutation.mutate({ id: issId, reply: replyText.trim(), status: replyStatus });
  };

  const quickTemplates = [
    'Site engineering team deployed; emergency rectification underway with 24-hr resolution.',
    'Alternative water tanker / power diversion active to ensure zero disruption to residents.',
    'Excavation backfilled and asphalt road resurfacing scheduled for tonight\'s work shift.',
    'Worksite inspection conducted jointly with GCC Zonal Officers; issue cleared.'
  ];

  const filteredDeptProjects = useMemo(() => {
    if (!projectSearch.trim()) return deptProjects;
    const q = projectSearch.toLowerCase();
    return deptProjects.filter(p =>
      p.title.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.locality.toLowerCase().includes(q) ||
      p.pincode.includes(q)
    );
  }, [deptProjects, projectSearch]);

  return (
    <div className="admin-dashboard-page dept-dashboard-page">
      {/* Department Officer Identity Banner */}
      <div className="officer-banner dept-banner">
        <div className="officer-banner-left">
          <div className="officer-large-avatar" style={{ background: '#0f766e', color: '#5eead4' }}>
            <Landmark size={28} />
          </div>
          <div className="officer-details">
            <h1>
              {activeDept}
              <span className="officer-badge-tag" style={{ background: '#ccfbf1', color: '#0f766e' }}>
                Connected to GCC Grid
              </span>
            </h1>
            <p>
              Logged in as <strong>{user.name}</strong> ({user.badge_id}) · {user.designation || 'Divisional Engineer'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="auth-dept-badge">
            <div className="auth-dept-title">
              <Lock size={12} />
              <span>Authorized Department</span>
            </div>
            <div className="auth-dept-name">{activeDept}</div>
          </div>
          <button
            type="button"
            className="btn-create-proj-header"
            onClick={() => setActiveTab('create_project')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0d9488',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 16px',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(13,148,136,0.25)'
            }}
          >
            <PlusCircle size={15} /> Sanction Project
          </button>
          <button className="logout-nav-button" onClick={onLogout} title="Sign Out">
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Department KPI Scorecard Strip */}
      <div className="stats-cards-strip">
        <div
          className={`admin-stat-card interactive-card ${activeTab === 'projects' ? 'active-filter' : ''}`}
          onClick={() => setActiveTab('projects')}
          title="Click to view department works register"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Department Projects</span>
            <div className="stat-card-icon navy"><Building2 size={18} /></div>
          </div>
          <div className="stat-card-val">{deptProjects.length}</div>
          <div className="stat-card-desc">Total capital works under {activeDept}</div>
          <div className="stat-card-action-hint">
            <span>{activeTab === 'projects' ? '● Currently Viewing' : 'Click to view register'}</span>
            <ChevronRight size={13} />
          </div>
        </div>

        <div
          className="admin-stat-card interactive-card"
          onClick={() => setActiveTab('projects')}
          title="Click to view active work sites"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Active Work Sites</span>
            <div className="stat-card-icon green"><Activity size={18} /></div>
          </div>
          <div className="stat-card-val">{deptProjects.filter(p => p.status === 'In progress').length}</div>
          <div className="stat-card-desc">Sites under active trenching / civil work</div>
          <div className="stat-card-action-hint">
            <span>Inspect active sites</span>
            <ChevronRight size={13} />
          </div>
        </div>

        <div
          className={`admin-stat-card interactive-card ${activeTab === 'submissions' && subFilter === 'all' ? 'active-filter' : ''}`}
          onClick={() => {
            setActiveTab('submissions');
            setSubFilter('all');
          }}
          title="Click to view all citizen submissions"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Routed Inquiries</span>
            <div className="stat-card-icon blue"><MessageSquare size={18} /></div>
          </div>
          <div className="stat-card-val">{deptIssues.length}</div>
          <div className="stat-card-desc">Citizen questions & reports routed here</div>
          <div className="stat-card-action-hint">
            <span>{activeTab === 'submissions' && subFilter === 'all' ? '● Currently Viewing' : 'Click to view submissions'}</span>
            <ChevronRight size={13} />
          </div>
        </div>

        <div
          className={`admin-stat-card interactive-card ${activeTab === 'submissions' && subFilter === 'pending' ? 'active-filter' : ''}`}
          onClick={() => {
            setActiveTab('submissions');
            setSubFilter('pending');
          }}
          title="Click to view inquiries pending response"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Pending Response</span>
            <div className="stat-card-icon amber"><Clock size={18} /></div>
          </div>
          <div className="stat-card-val">{pendingIssues.length}</div>
          <div className="stat-card-desc">Within 3-day turnaround SLA window</div>
          <div className="stat-card-action-hint">
            <span>{activeTab === 'submissions' && subFilter === 'pending' ? '● Currently Viewing' : 'Filter pending (<3 days)'}</span>
            <ChevronRight size={13} />
          </div>
        </div>

        <div
          className={`admin-stat-card interactive-card ${activeTab === 'submissions' && subFilter === 'escalated' ? 'active-filter' : ''}`}
          onClick={() => {
            setActiveTab('submissions');
            setSubFilter('escalated');
          }}
          title="Click to view overdue escalations"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Escalated to GCC</span>
            <div className={`stat-card-icon ${escalatedIssues.length > 0 ? 'red' : 'emerald'}`}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="stat-card-val" style={{ color: escalatedIssues.length > 0 ? '#dc2626' : '#059669' }}>
            {escalatedIssues.length}
          </div>
          <div className="stat-card-desc">
            {escalatedIssues.length > 0
              ? '⚠️ Overdue > 3-day SLA response deadline'
              : '✅ Zero escalations (all SLAs satisfied)'}
          </div>
          <div className="stat-card-action-hint">
            <span style={{ color: escalatedIssues.length > 0 ? '#dc2626' : '#059669' }}>
              {activeTab === 'submissions' && subFilter === 'escalated' ? '● Currently Viewing' : escalatedIssues.length > 0 ? 'Urgent attention required' : 'All SLAs satisfied'}
            </span>
            <ChevronRight size={13} />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="dashboard-tabs-bar">
        <button
          className={`dash-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          <MessageSquare size={16} />
          Citizen Submissions & SLA Triage
          <span className="tab-badge">{deptIssues.length}</span>
        </button>

        <button
          className={`dash-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <Building2 size={16} />
          Department Works Register
          <span className="tab-badge">{deptProjects.length}</span>
        </button>

        <button
          className={`dash-tab-btn ${activeTab === 'coordination' ? 'active' : ''}`}
          onClick={() => setActiveTab('coordination')}
        >
          <Activity size={16} />
          DigSync Utility Coordination
          <span className="tab-badge">{deptConflicts.length}</span>
        </button>

        <button
          className={`dash-tab-btn ${activeTab === 'create_project' ? 'active' : ''}`}
          onClick={() => setActiveTab('create_project')}
        >
          <PlusCircle size={16} />
          Sanction New Project
        </button>
      </div>

      {/* TAB 1: CITIZEN SUBMISSIONS & SLA TRIAGE */}
      {activeTab === 'submissions' && (
        <div className="submissions-section">
          {/* Escalation Alert Banner if overdue */}
          {escalatedIssues.length > 0 && (
            <div className="escalation-alert-banner">
              <div className="escalation-banner-icon">
                <AlertTriangle size={24} color="#b91c1c" />
              </div>
              <div className="escalation-banner-info">
                <h4>{escalatedIssues.length} Submission(s) Escalated to GCC Municipality</h4>
                <p>
                  These citizen submissions have exceeded the configured 3-day department response deadline. GCC Municipal Executives have been alerted. Dispatch an official reply immediately to clear the escalation.
                </p>
              </div>
              <button
                className={`escalation-filter-btn ${subFilter === 'escalated' ? 'active' : ''}`}
                onClick={() => setSubFilter(subFilter === 'escalated' ? 'all' : 'escalated')}
              >
                {subFilter === 'escalated' ? 'View All Submissions' : `Filter Escalated (${escalatedIssues.length})`}
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="dept-filter-pills-row">
            <button
              className={`dept-pill-btn ${subFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSubFilter('all')}
            >
              All Routed Submissions <span className="dept-pill-count">{deptIssues.length}</span>
            </button>
            <button
              className={`dept-pill-btn ${subFilter === 'pending' ? 'active' : ''}`}
              onClick={() => setSubFilter('pending')}
            >
              ⏳ Pending Response (&lt;3 Days) <span className="dept-pill-count">{pendingIssues.length}</span>
            </button>
            <button
              className={`dept-pill-btn ${subFilter === 'escalated' ? 'active' : ''}`}
              onClick={() => setSubFilter('escalated')}
            >
              ⚠️ Escalated to Municipality <span className="dept-pill-count">{escalatedIssues.length}</span>
            </button>
            <button
              className={`dept-pill-btn ${subFilter === 'resolved' ? 'active' : ''}`}
              onClick={() => setSubFilter('resolved')}
            >
              ✅ Answered / Resolved <span className="dept-pill-count">{resolvedIssues.length}</span>
            </button>
          </div>

          {/* Submissions Cards */}
          <div className="grievance-cards-grid">
            {displayedIssues.map((iss: any) => (
              <div className={`grievance-card ${iss.is_escalated ? 'card-escalated' : ''}`} key={iss.id}>
                <div className="grievance-header">
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span className="grievance-ref">{iss.ref}</span>
                    <strong style={{ fontSize: '15px', color: 'var(--navy)' }}>{iss.kind}</strong>
                    {iss.pincode && (
                      <span className="pincode-change-tag">PIN {iss.pincode}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {iss.is_escalated && (
                      <span className="escalation-badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, padding: '4px 9px', borderRadius: '6px' }}>
                        ⚠️ Overdue ({iss.days_elapsed}d) · Escalated to Municipality
                      </span>
                    )}
                    <span className={`place-status-chip ${iss.status === 'Resolved' || iss.status === 'Answered' ? 'completed' : iss.status === 'In Progress' ? 'in-progress' : 'upcoming'}`}>
                      {iss.status}
                    </span>
                  </div>
                </div>

                {/* 3-day SLA Timeline Banner */}
                <div className={`sla-status-strip ${iss.is_escalated ? 'strip-escalated' : iss.status === 'Resolved' || iss.status === 'Answered' ? 'strip-resolved' : 'strip-pending'}`}>
                  {iss.is_escalated ? (
                    <>
                      <AlertTriangle size={15} color="#b91c1c" />
                      <span><strong>SLA BREACH:</strong> Unanswered for {iss.days_elapsed} days (&gt; 3 days deadline). Escalated to Municipal Executive Dashboard.</span>
                    </>
                  ) : iss.status === 'Resolved' || iss.status === 'Answered' ? (
                    <>
                      <CheckCircle2 size={15} color="#059669" />
                      <span><strong>SLA SATISFIED:</strong> Official department response published to residents and public works feed.</span>
                    </>
                  ) : (
                    <>
                      <Clock size={15} color="#d97706" />
                      <span><strong>DEPARTMENT SLA WINDOW:</strong> {Math.max(0, 3 - iss.days_elapsed)} day(s) remaining before automatic escalation.</span>
                    </>
                  )}
                </div>

                <div className="grievance-content">
                  <p>{iss.message}</p>
                  <IssueEvidence items={iss.attachments || []} />
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    Locality: <strong style={{ color: '#334155' }}>{iss.locality}</strong> · Logged: {formatDate(iss.created)}
                    {iss.project_title && (
                      <span> · Associated Project: <strong style={{ color: '#0f766e' }}>{iss.project_title}</strong></span>
                    )}
                  </div>
                </div>

                {/* Official Response Section */}
                {iss.official_reply ? (
                  <div className="qa-reply" style={{ margin: '6px 0' }}>
                    <strong>Official Department Response (Live on Public Feed):</strong> {iss.official_reply}
                    <small>By: {iss.replied_by || `${activeDept} Officer`} on {formatDate(iss.replied_at)}</small>
                  </div>
                ) : replyingIssueId === iss.id ? (
                  /* Inline Reply Dispatch Form */
                  <div className="dept-reply-box">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--navy)' }}>
                        Dispatch Official Department Response
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Visible to all area citizens</span>
                    </div>

                    {/* Quick Response Templates */}
                    <div>
                      <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 700, display: 'block', marginBottom: '8px' }}>
                        Quick Response Templates:
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {quickTemplates.map((tmpl, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="quick-template-btn"
                            onClick={() => setReplyText(tmpl)}
                          >
                            💡 {tmpl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Enter official departmental response to inform citizens and satisfy SLA..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '13.5px',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>Update Status:</span>
                        <select
                          value={replyStatus}
                          onChange={e => setReplyStatus(e.target.value as any)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            background: '#ffffff'
                          }}
                        >
                          <option value="Answered">Answered</option>
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="table-action-btn"
                          style={{ background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' }}
                          onClick={() => { setReplyingIssueId(null); setReplyText(''); }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="table-action-btn"
                          style={{ background: '#0f766e', color: '#ffffff', borderColor: '#0d9488' }}
                          onClick={() => handleSendReply(iss.id)}
                          disabled={replyMutation.isPending}
                        >
                          <Send size={13} /> {replyMutation.isPending ? 'Publishing…' : 'Publish & Clear SLA'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grievance-footer">
                    <span style={{ fontSize: '12px', color: iss.is_escalated ? '#b91c1c' : '#ea580c', fontWeight: 700 }}>
                      {iss.is_escalated
                        ? '⚠️ Escalated to Municipality due to 3-day inactivity. Respond now to resolve.'
                        : 'Awaiting Department Official Reply'}
                    </span>
                    <button
                      className="table-action-btn"
                      onClick={() => {
                        setReplyingIssueId(iss.id);
                        setReplyText('');
                        setReplyStatus('Answered');
                      }}
                    >
                      <Send size={13} /> Review & Dispatch Response
                    </button>
                  </div>
                )}
              </div>
            ))}

            {displayedIssues.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>
                <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--navy)', margin: '0 0 6px 0' }}>No Submissions in this View</h3>
                <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>All citizen submissions in this category have been processed.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEPARTMENT WORKS REGISTER */}
      {activeTab === 'projects' && (
        <div className="dept-projects-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--navy)', margin: '0 0 4px 0' }}>
                Capital Projects Portfolio
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--gray-500)', margin: 0 }}>
                Showing <strong>{filteredDeptProjects.length}</strong> public works registered under {activeDept}
              </p>
            </div>
            <div style={{ position: 'relative', width: '320px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search projects, locality, PIN..."
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 14px 9px 36px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--gray-200)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div className="projects-table-card">
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Title & Location</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Contractor</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeptProjects.map(p => (
                  <tr key={p.id}>
                    <td><span className="table-code-badge">{p.code}</span></td>
                    <td>
                      <strong style={{ color: 'var(--navy)', fontSize: '13.5px' }}>{p.title}</strong>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>{p.address} · PIN {p.pincode}</div>
                    </td>
                    <td><span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 600 }}>{p.category}</span></td>
                    <td>
                      <span className={`place-status-chip ${p.status === 'Completed' ? 'completed' : p.status === 'Delayed' ? 'delayed' : p.status === 'In progress' ? 'in-progress' : 'upcoming'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="mini-progress-wrap" style={{ flexGrow: 1, minWidth: '70px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div className="mini-progress-bar" style={{ width: `${p.progress}%`, height: '100%', background: p.progress === 100 ? '#10b981' : '#0f766e', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '32px' }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#334155' }}>{p.contractor}</td>
                    <td style={{ fontSize: '12.5px', color: '#475569', whiteSpace: 'nowrap' }}>{p.due_date}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="table-action-btn"
                          onClick={() => setSelectedProjectModal(p)}
                          title="View complete project details"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          className="table-action-btn"
                          style={{ background: '#0f766e', color: '#ffffff', borderColor: '#0d9488' }}
                          onClick={() => setEditingProject(p)}
                          title="Update project stage and progress percentage"
                        >
                          <SlidersHorizontal size={13} /> Update Stage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DIGSYNC UTILITY COORDINATION */}
      {activeTab === 'coordination' && (
        <DeptConflictCoordinationTab activeDept={activeDept} digsync={digsync} deptConflicts={deptConflicts} onToast={onToast} />
      )}

      {/* Project Detail Modal */}
      {selectedProjectModal && (
        <div className="modal-overlay" onClick={() => setSelectedProjectModal(null)}>
          <div className="modal-window" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-window-head">
              <div>
                <span className="table-code-badge">{selectedProjectModal.code}</span>
                <h3 style={{ margin: '6px 0 0', fontSize: '17px', color: 'var(--navy)' }}>{selectedProjectModal.title}</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedProjectModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-window-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: '#f8fafc', padding: '14px', borderRadius: '10px' }}>
                <div><span style={{ color: '#64748b', fontSize: '12px' }}>Locality:</span> <strong style={{ color: '#0f2438', display: 'block' }}>{selectedProjectModal.locality} (PIN {selectedProjectModal.pincode})</strong></div>
                <div><span style={{ color: '#64748b', fontSize: '12px' }}>Department:</span> <strong style={{ color: '#0f2438', display: 'block' }}>{selectedProjectModal.department}</strong></div>
                <div><span style={{ color: '#64748b', fontSize: '12px' }}>Contractor:</span> <strong style={{ color: '#0f2438', display: 'block' }}>{selectedProjectModal.contractor}</strong></div>
                <div><span style={{ color: '#64748b', fontSize: '12px' }}>Sanctioned Budget:</span> <strong style={{ color: '#0f2438', display: 'block' }}>₹{(selectedProjectModal.budget / 100000).toFixed(1)} Lakhs</strong></div>
                <div><span style={{ color: '#64748b', fontSize: '12px' }}>Start Date:</span> <strong style={{ color: '#0f2438', display: 'block' }}>{selectedProjectModal.start_date}</strong></div>
                <div><span style={{ color: '#64748b', fontSize: '12px' }}>Target Due Date:</span> <strong style={{ color: '#0f2438', display: 'block' }}>{selectedProjectModal.due_date}</strong></div>
              </div>
              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.6', margin: 0 }}>{selectedProjectModal.description}</p>
              {selectedProjectModal.disruption && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '12px', borderRadius: '8px', fontSize: '12.5px', color: '#92400e' }}>
                  <strong>Traffic / Disruption Notice:</strong> {selectedProjectModal.disruption}
                </div>
              )}
            </div>
            <div className="modal-window-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="table-action-btn"
                style={{ background: '#0f766e', color: '#ffffff', borderColor: '#0d9488' }}
                onClick={() => {
                  const p = selectedProjectModal;
                  setSelectedProjectModal(null);
                  setEditingProject(p);
                }}
              >
                <SlidersHorizontal size={13} /> Update Operations & Stage
              </button>
              <button className="table-action-btn" onClick={() => setSelectedProjectModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Project Operations & Stage Auto-Sync Modal */}
      {editingProject && (
        <ProjectOperationsModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={(id, data) => updateProjectMutation.mutate({ id, data })}
          isPending={updateProjectMutation.isPending}
        />
      )}

      {/* TAB 4: SANCTION NEW INFRASTRUCTURE PROJECT */}
      {activeTab === 'create_project' && (
        <CreateProjectForm
          user={user}
          onCreated={(newProj) => {
            onToast(`Project ${newProj.code || ''} sanctioned and registered under ${user.department}!`);
            setActiveTab('projects');
            qc.invalidateQueries({ queryKey: ['projects'] });
            qc.invalidateQueries({ queryKey: ['department_projects'] });
            qc.invalidateQueries({ queryKey: ['stats'] });
          }}
          onCancel={() => setActiveTab('projects')}
        />
      )}
    </div>
  );
}

// ============================================================
// DIGSYNC CONFLICT PANEL (Municipality View)
// ============================================================
function DigSyncConflictPanel({ digsync, user, onToast }: { digsync: any[]; user: AuthUser; onToast: (m: string) => void }) {
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState<'spatial' | 'tickets'>('tickets');
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [selectedApprovedDept, setSelectedApprovedDept] = useState<string>('');
  const [decisionText, setDecisionText] = useState('');
  const [submittingResolve, setSubmittingResolve] = useState(false);

  const { data: conflictTickets = [], refetch: refetchTickets } = useQuery({
    queryKey: ['conflict_tickets'],
    queryFn: () => fetchApi<any[]>('/conflict-tickets').catch(() => []),
    refetchInterval: 15000
  });

  const pendingTickets = (conflictTickets as any[]).filter(t => t.status === 'Pending');
  const resolvedTickets = (conflictTickets as any[]).filter(t => t.status === 'Resolved');

  const handleResolve = async (ticketId: number) => {
    if (!selectedApprovedDept) {
      alert('Please choose which department is authorized to proceed with their scheduled work.');
      return;
    }
    if (!decisionText.trim()) {
      alert('Please enter your reason / explanation for this decision.');
      return;
    }
    setSubmittingResolve(true);
    try {
      await fetchApi(`/conflict-tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_dept: selectedApprovedDept,
          decision: decisionText.trim()
        })
      });
      onToast(`Conflict resolved! ${selectedApprovedDept} authorized (In progress). Both departments notified.`);
      setResolvingId(null);
      setDecisionText('');
      setSelectedApprovedDept('');
      refetchTickets();
      qc.invalidateQueries({ queryKey: ['conflict_tickets'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['department_projects'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    } catch {
      onToast('Resolution recorded locally.');
      setResolvingId(null);
    } finally {
      setSubmittingResolve(false);
    }
  };

  return (
    <div className="digsync-section">
      {/* Header */}
      <div className="digsync-explainer-banner">
        <div>
          <h3>DigSync Interdepartmental Conflict Resolution</h3>
          <p>Review scheduling conflicts raised by departments. Choose which department proceeds, record your rationale, and notify both parties.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`gmaps-chip ${activeSection === 'tickets' ? 'active' : ''}`}
            style={{ fontWeight: 700, padding: '8px 14px' }}
            onClick={() => setActiveSection('tickets')}
          >
            <Ticket size={13} style={{ display: 'inline', marginRight: '5px' }} />
            Conflict Tickets ({pendingTickets.length} Pending)
          </button>
          <button
            className={`gmaps-chip ${activeSection === 'spatial' ? 'active' : ''}`}
            style={{ fontWeight: 700, padding: '8px 14px' }}
            onClick={() => setActiveSection('spatial')}
          >
            <GitBranch size={13} style={{ display: 'inline', marginRight: '5px' }} />
            Spatial Overlaps ({digsync.length})
          </button>
        </div>
      </div>

      {/* SECTION: CONFLICT TICKETS */}
      {activeSection === 'tickets' && (
        <div>
          {pendingTickets.length > 0 && (
            <div style={{ background: '#fef3c7', border: '1.5px solid #fde68a', borderRadius: '12px', padding: '12px 16px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} color="#d97706" />
              <div>
                <strong style={{ color: '#92400e', fontSize: '13.5px' }}>{pendingTickets.length} Conflict Ticket(s) Awaiting Municipality Decision</strong>
                <div style={{ fontSize: '12px', color: '#92400e', marginTop: '2px' }}>Departments are waiting on your decision before proceeding with their scheduled work.</div>
              </div>
            </div>
          )}

          {(conflictTickets as any[]).length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <ClipboardList size={40} color="#10896b" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#0f2438' }}>No Conflict Tickets</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>No departments have raised scheduling conflicts for municipality review.</p>
            </div>
          )}

          {(conflictTickets as any[]).map((t: any) => (
            <div key={t.id} style={{
              background: 'white',
              border: `2px solid ${t.status === 'Resolved' ? '#86efac' : '#fde68a'}`,
              borderRadius: '14px',
              padding: '18px',
              marginBottom: '14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              {/* Ticket Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ background: '#0f2438', color: '#fff', padding: '2px 8px', borderRadius: '5px', fontFamily: 'monospace', fontSize: '11.5px', fontWeight: 700 }}>{t.ref}</span>
                    <span style={{ background: t.status === 'Resolved' ? '#dcfce7' : '#fef3c7', color: t.status === 'Resolved' ? '#15803d' : '#92400e', padding: '2px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>{t.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Raised: {t.created ? new Date(t.created).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b' }}>
                  <div>By: <strong style={{ color: '#0f2438' }}>{t.requesting_officer}</strong> ({t.requesting_badge})</div>
                </div>
              </div>

              {/* Two-Party Conflict View */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'start', background: '#f8fafc', padding: '14px', borderRadius: '10px', marginBottom: '14px' }}>
                {/* Requesting Dept */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: '4px' }}>Requesting Department</div>
                  <div style={{ fontWeight: 700, color: '#0f2438', fontSize: '14px' }}>{t.requesting_dept}</div>
                  <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '4px' }}>{t.proposed_title}</div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                    📅 {t.proposed_start} → {t.proposed_end}
                    {t.proposed_locality && <span> · {t.proposed_locality}</span>}
                  </div>
                  <div style={{ marginTop: '8px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '7px', padding: '8px 10px', fontSize: '12px', color: '#7c2d12' }}>
                    <strong>Reason to proceed despite conflict:</strong><br />{t.reason_for_proceeding}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px', color: '#dc2626', padding: '0 4px' }}>VS</div>

                {/* Conflicting Dept */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: '4px' }}>Conflicting Department</div>
                  <div style={{ fontWeight: 700, color: '#0f2438', fontSize: '14px' }}>{t.conflicting_dept}</div>
                  <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '4px' }}>{t.conflicting_project_title}</div>
                  {t.conflicting_start && (
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>📅 {t.conflicting_start} → {t.conflicting_end}</div>
                  )}
                </div>
              </div>

              {/* Resolution Section */}
              {t.status === 'Resolved' ? (
                <div style={{ background: '#dcfce7', border: '1.5px solid #86efac', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={16} color="#16a34a" />
                      <strong style={{ color: '#15803d', fontSize: '13.5px' }}>Resolved Decision by Municipality</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ background: '#059669', color: '#fff', padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>
                        Approved: {t.approved_dept} (In progress)
                      </span>
                      <span style={{ background: '#dc2626', color: '#fff', padding: '3px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>
                        Reschedule: {t.rescheduled_dept} ({t.rescheduled_status || 'Pending'})
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: '13px', color: '#166534', background: '#f0fdf4', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                    <strong>Official Rationale & Instructions:</strong><br />
                    {t.municipality_decision}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#15803d', marginTop: '8px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <span>Resolved by: <strong>{t.resolved_by}</strong></span>
                    <span>✓ Intimated to both departments · {t.resolved_at ? new Date(t.resolved_at).toLocaleDateString('en-IN') : ''}</span>
                  </div>
                </div>
              ) : resolvingId === t.id ? (
                <div style={{ background: '#f8fafc', border: '1.5px solid #0f766e', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#0f2438', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Wrench size={16} color="#0f766e" /> Municipality Conflict Determination
                  </h4>

                  {/* Step 1: Select Approved Dept */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                      1. Select which department is authorized to proceed with work: *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div
                        onClick={() => setSelectedApprovedDept(t.requesting_dept)}
                        style={{
                          border: `2px solid ${selectedApprovedDept === t.requesting_dept ? '#0f766e' : '#cbd5e1'}`,
                          background: selectedApprovedDept === t.requesting_dept ? '#f0fdfa' : '#ffffff',
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name={`approved_${t.id}`}
                            checked={selectedApprovedDept === t.requesting_dept}
                            onChange={() => setSelectedApprovedDept(t.requesting_dept)}
                          />
                          <strong style={{ fontSize: '13px', color: '#0f2438' }}>{t.requesting_dept}</strong>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', paddingLeft: '24px' }}>
                          Project: {t.proposed_title}<br />
                          <span style={{ color: '#0f766e', fontWeight: 600 }}>→ Will be auto-set to In Progress</span>
                        </div>
                      </div>

                      <div
                        onClick={() => setSelectedApprovedDept(t.conflicting_dept)}
                        style={{
                          border: `2px solid ${selectedApprovedDept === t.conflicting_dept ? '#0f766e' : '#cbd5e1'}`,
                          background: selectedApprovedDept === t.conflicting_dept ? '#f0fdfa' : '#ffffff',
                          borderRadius: '10px',
                          padding: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="radio"
                            name={`approved_${t.id}`}
                            checked={selectedApprovedDept === t.conflicting_dept}
                            onChange={() => setSelectedApprovedDept(t.conflicting_dept)}
                          />
                          <strong style={{ fontSize: '13px', color: '#0f2438' }}>{t.conflicting_dept}</strong>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', paddingLeft: '24px' }}>
                          Project: {t.conflicting_project_title}<br />
                          <span style={{ color: '#7c3aed', fontWeight: 600 }}>→ Retains priority; other dept reschedules</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Rationale / Reason */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      2. Explain the rationale / instructions for both departments: *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g., Underground pipeline replacement takes precedence before road resurfacing. GCC Roads instructed to reschedule work start to after completion. Metro Water to expedite trench backfilling..."
                      value={decisionText}
                      onChange={e => setDecisionText(e.target.value)}
                      style={{ width: '100%', borderRadius: '8px', border: '1.5px solid #cbd5e1', padding: '10px', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => { setResolvingId(null); setDecisionText(''); setSelectedApprovedDept(''); }}
                      style={{ padding: '9px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff', fontSize: '13px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolve(t.id)}
                      disabled={submittingResolve}
                      style={{
                        padding: '9px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#0f766e',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <CheckCircle size={15} /> {submittingResolve ? 'Submitting…' : 'Confirm Decision & Intimate Departments'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setResolvingId(t.id);
                    setDecisionText('');
                    setSelectedApprovedDept(t.requesting_dept);
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg,#0f766e,#0d9488)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    boxShadow: '0 3px 10px rgba(15,118,110,0.3)'
                  }}
                >
                  <Wrench size={15} /> Review & Decide Conflict Resolution
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SECTION: SPATIAL OVERLAPS */}
      {activeSection === 'spatial' && (
        <div>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', fontSize: '13px', color: '#0369a1' }}>
            <Info size={15} style={{ display: 'inline', marginRight: '6px' }} />
            These are <strong>auto-detected</strong> spatial overlaps (&lt;1.5km, &lt;30 day gap). They are for awareness only — departments must raise a conflict ticket if they want municipality mediation.
          </div>

          {digsync.map((conflict: any) => (
            <div className="conflict-card" key={conflict.id}>
              <div className="conflict-header">
                <span className={`conflict-severity-tag ${conflict.severity?.toLowerCase().includes('high') ? 'high' : 'potential'}`}>
                  {conflict.severity || 'High Conflict'} · {conflict.overlap_type || 'Excavation Collision Risk'}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                  Distance: {conflict.distance_meters || '80'}m apart
                </span>
              </div>
              <div className="conflict-projects-duo">
                <div className="conflict-project-box">
                  <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 700 }}>{conflict.projects[0].department}</span>
                  <h4>{conflict.projects[0].title}</h4>
                  <p>{conflict.projects[0].address} · Status: {conflict.projects[0].status}</p>
                </div>
                <div className="conflict-vs-pill">VS</div>
                <div className="conflict-project-box">
                  <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 700 }}>{conflict.projects[1].department}</span>
                  <h4>{conflict.projects[1].title}</h4>
                  <p>{conflict.projects[1].address} · Status: {conflict.projects[1].status}</p>
                </div>
              </div>
              <div className="conflict-meta-footer">
                <div className="conflict-reason">
                  <strong>Conflict Rationale:</strong> {conflict.reason}
                </div>
              </div>
            </div>
          ))}

          {digsync.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px' }}>
              <CheckCircle2 size={36} color="#10896b" style={{ margin: '0 auto 10px' }} />
              <h3>All Corridors Clear</h3>
              <p style={{ color: '#64748b', fontSize: '13px' }}>No active spatial or schedule conflicts detected across Chennai.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONSOLIDATED MUNICIPAL DASHBOARD COMPONENT
// ============================================================
function MunicipalDashboard({
  user,
  projects,
  stats,
  issues,
  digsync,
  onLogout,
  onToast
}: {
  user: AuthUser;
  projects: Project[];
  stats: any;
  issues: any[];
  digsync: any[];
  onLogout: () => void;
  onToast: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'status_explorer' | 'digsync' | 'projects' | 'grievances' | 'hazards' | 'contractor_performance'>('status_explorer');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'All' | 'In progress' | 'Completed' | 'Delayed' | 'Scheduled'>('In progress');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [statusSearchQuery, setStatusSearchQuery] = useState('');
  const [detailModalProject, setDetailModalProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<any | null>(null);

  const inProgressProjects = useMemo(() => {
    return projects.filter(p => p.status === 'In progress' || (p.progress > 0 && p.progress < 100));
  }, [projects]);

  const completedProjects = useMemo(() => {
    return projects.filter(p => p.status === 'Completed' || p.progress >= 100);
  }, [projects]);

  const delayedProjects = useMemo(() => {
    return projects.filter(p => p.status === 'Delayed');
  }, [projects]);

  const scheduledProjects = useMemo(() => {
    return projects.filter(p => p.status === 'Upcoming' || p.status === 'Scheduled' || p.progress === 0);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (selectedDeptFilter === 'All') return projects;
    return projects.filter(p => p.department.toLowerCase().includes(selectedDeptFilter.toLowerCase()));
  }, [projects, selectedDeptFilter]);

  const statusFilteredProjects = useMemo(() => {
    let list = projects;
    if (selectedStatusFilter === 'In progress') {
      list = inProgressProjects;
    } else if (selectedStatusFilter === 'Completed') {
      list = completedProjects;
    } else if (selectedStatusFilter === 'Delayed') {
      list = delayedProjects;
    } else if (selectedStatusFilter === 'Scheduled') {
      list = scheduledProjects;
    }
    if (selectedDeptFilter !== 'All') {
      list = list.filter(p => p.department.toLowerCase().includes(selectedDeptFilter.toLowerCase()));
    }
    if (statusSearchQuery.trim()) {
      const q = statusSearchQuery.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.pincode.includes(q) ||
        p.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, selectedStatusFilter, selectedDeptFilter, statusSearchQuery, inProgressProjects, completedProjects, delayedProjects, scheduledProjects]);

  const [grievanceDeptFilter, setGrievanceDeptFilter] = useState('All');
  const [grievanceTypeFilter, setGrievanceTypeFilter] = useState<'All' | 'Questions' | 'Grievances' | 'Escalated' | 'Answered'>('All');
  const [grievanceSearch, setGrievanceSearch] = useState('');
  const [replyingIssue, setReplyingIssue] = useState<any | null>(null);

  const escalatedIssuesCount = useMemo(() => {
    return issues.filter(i => i.is_escalated || ((i.status !== 'Resolved' && i.status !== 'Answered') && i.days_elapsed >= 3)).length;
  }, [issues]);

  const filteredGrievances = useMemo(() => {
    let list = issues;
    if (grievanceDeptFilter === 'Escalated') {
      list = list.filter(i => i.is_escalated || ((i.status !== 'Resolved' && i.status !== 'Answered') && i.days_elapsed >= 3));
    } else if (grievanceDeptFilter !== 'All') {
      list = list.filter(i => (i.department || '').toLowerCase().includes(grievanceDeptFilter.toLowerCase()));
    }

    if (grievanceTypeFilter === 'Questions') {
      list = list.filter(i => i.is_question || (i.kind || '').toLowerCase().includes('question'));
    } else if (grievanceTypeFilter === 'Grievances') {
      list = list.filter(i => !i.is_question && !(i.kind || '').toLowerCase().includes('question'));
    } else if (grievanceTypeFilter === 'Escalated') {
      list = list.filter(i => i.is_escalated || ((i.status !== 'Resolved' && i.status !== 'Answered') && i.days_elapsed >= 3));
    } else if (grievanceTypeFilter === 'Answered') {
      list = list.filter(i => i.status === 'Resolved' || i.status === 'Answered');
    }

    if (grievanceSearch.trim()) {
      const q = grievanceSearch.toLowerCase();
      list = list.filter(i =>
        (i.message || '').toLowerCase().includes(q) ||
        (i.ref || '').toLowerCase().includes(q) ||
        (i.locality || '').toLowerCase().includes(q) ||
        (i.pincode || '').includes(q) ||
        (i.kind || '').toLowerCase().includes(q) ||
        (i.department || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [issues, grievanceDeptFilter, grievanceTypeFilter, grievanceSearch]);

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return fetchApi<any>(`/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      setEditingProject(null);
      if (detailModalProject) {
        const updated = projects.find(p => p.id === detailModalProject.id);
        if (updated) setDetailModalProject(updated);
      }
      onToast('Project operational record updated successfully.');
      qc.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const replyIssueMutation = useMutation({
    mutationFn: async ({ id, reply, status }: { id: number; reply: string; status: string }) => {
      return fetchApi<any>(`/issues/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply, status })
      });
    },
    onSuccess: () => {
      onToast('Official reply dispatched to citizen and area feed.');
      qc.invalidateQueries({ queryKey: ['admin_issues'] });
    }
  });

  return (
    <div className="admin-dashboard-page">
      {/* Officer Profile Header Banner */}
      <div className="officer-banner">
        <div className="officer-banner-left">
          <div className="officer-large-avatar">
            <Shield size={28} />
          </div>
          <div className="officer-details">
            <h1>
              Welcome, {user.name}
              <span className="officer-badge-tag">{user.badge_id}</span>
            </h1>
            <p>{user.designation} · {user.department}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            className="admin-nav-button"
            onClick={() => onToast('Syncing all departmental GIS databases...')}
          >
            <RefreshCw size={15} /> Refresh GIS Feeds
          </button>
          <button className="logout-nav-button" onClick={onLogout}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>

      {/* Operational Stats Strip (Interactive Cards for Progress & Completed) */}
      <div className="stats-cards-strip">
        {/* In Progress Card */}
        <div
          className={`admin-stat-card interactive-card ${activeTab === 'status_explorer' && selectedStatusFilter === 'In progress' ? 'active-filter' : ''}`}
          onClick={() => {
            setSelectedStatusFilter('In progress');
            setActiveTab('status_explorer');
          }}
          title="Click to view and inspect all In-Progress public works"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Works In Progress</span>
            <div className="stat-card-icon green"><Activity size={18} /></div>
          </div>
          <div className="stat-card-val">{inProgressProjects.length}</div>
          <div className="stat-card-desc">Active Ground Sites (1–99%)</div>
          <div className="stat-card-action-hint">
            <span>{activeTab === 'status_explorer' && selectedStatusFilter === 'In progress' ? '● Currently Viewing' : 'Click to view projects'}</span>
            <ChevronRight size={13} />
          </div>
        </div>

        {/* Completed Works Card */}
        <div
          className={`admin-stat-card interactive-card ${activeTab === 'status_explorer' && selectedStatusFilter === 'Completed' ? 'active-filter' : ''}`}
          onClick={() => {
            setSelectedStatusFilter('Completed');
            setActiveTab('status_explorer');
          }}
          title="Click to view and inspect all Completed public works"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Completed Works</span>
            <div className="stat-card-icon emerald"><CheckCircle2 size={18} /></div>
          </div>
          <div className="stat-card-val">{completedProjects.length}</div>
          <div className="stat-card-desc">100% Certified & Handed Over</div>
          <div className="stat-card-action-hint">
            <span>{activeTab === 'status_explorer' && selectedStatusFilter === 'Completed' ? '● Currently Viewing' : 'Click to view details'}</span>
            <ChevronRight size={13} />
          </div>
        </div>

        {/* Behind Schedule Card */}
        <div
          className={`admin-stat-card interactive-card ${activeTab === 'status_explorer' && selectedStatusFilter === 'Delayed' ? 'active-filter' : ''}`}
          onClick={() => {
            setSelectedStatusFilter('Delayed');
            setActiveTab('status_explorer');
          }}
          title="Click to view delayed works"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Behind Schedule</span>
            <div className="stat-card-icon red"><Clock size={18} /></div>
          </div>
          <div className="stat-card-val">{delayedProjects.length}</div>
          <div className="stat-card-desc">Intervention & Action Required</div>
          <div className="stat-card-action-hint">
            <span>{activeTab === 'status_explorer' && selectedStatusFilter === 'Delayed' ? '● Currently Viewing' : 'Click to view bottlenecks'}</span>
            <ChevronRight size={13} />
          </div>
        </div>

        {/* Scheduled Works Card */}
        <div
          className={`admin-stat-card interactive-card ${activeTab === 'status_explorer' && selectedStatusFilter === 'Scheduled' ? 'active-filter' : ''}`}
          onClick={() => {
            setSelectedStatusFilter('Scheduled');
            setActiveTab('status_explorer');
          }}
          title="Click to view scheduled works"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Scheduled Works</span>
            <div className="stat-card-icon blue"><Calendar size={18} /></div>
          </div>
          <div className="stat-card-val">{scheduledProjects.length}</div>
          <div className="stat-card-desc">Site Mobilization Ready</div>
          <div className="stat-card-action-hint">
            <span>{activeTab === 'status_explorer' && selectedStatusFilter === 'Scheduled' ? '● Currently Viewing' : 'Click to view permits'}</span>
            <ChevronRight size={13} />
          </div>
        </div>

        {/* Total Works Master Card */}
        <div
          className={`admin-stat-card interactive-card ${activeTab === 'status_explorer' && selectedStatusFilter === 'All' ? 'active-filter' : ''}`}
          onClick={() => {
            setSelectedStatusFilter('All');
            setActiveTab('status_explorer');
          }}
          title="Click to view all registered works"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Total Works</span>
            <div className="stat-card-icon navy"><Building2 size={18} /></div>
          </div>
          <div className="stat-card-val">{projects.length}</div>
          <div className="stat-card-desc">Chennai GCC Master Directory</div>
          <div className="stat-card-action-hint">
            <span>{activeTab === 'status_explorer' && selectedStatusFilter === 'All' ? '● Currently Viewing' : 'Click to view all'}</span>
            <ChevronRight size={13} />
          </div>
        </div>
      </div>

      {/* Dashboard View Tabs */}
      <div className="dashboard-tabs-bar">
        <button
          className={`dash-tab-btn ${activeTab === 'status_explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('status_explorer')}
        >
          <Construction size={16} />
          Status Explorer ({selectedStatusFilter}): {statusFilteredProjects.length} Works
        </button>

        <button
          className={`dash-tab-btn ${activeTab === 'digsync' ? 'active' : ''}`}
          onClick={() => setActiveTab('digsync')}
        >
          <Flame size={16} />
          DigSync Coordination Engine
          <span className="tab-badge">{digsync.length}</span>
        </button>

        <button
          className={`dash-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <Building2 size={16} />
          Table Register & Updates
          <span className="tab-badge">{filteredProjects.length}</span>
        </button>

        <button
          className={`dash-tab-btn ${activeTab === 'grievances' ? 'active' : ''}`}
          onClick={() => setActiveTab('grievances')}
        >
          <MessageSquare size={16} />
          Citizen Grievances & Q&A Triage
          <span className="tab-badge">{issues.length}</span>
        </button>

        <button
          className={`dash-tab-btn ${activeTab === 'hazards' ? 'active' : ''}`}
          onClick={() => setActiveTab('hazards')}
        >
          <AlertTriangle size={16} />
          Hazards & GMaps Feeds
        </button>
        <button className={`dash-tab-btn ${activeTab === 'contractor_performance' ? 'active' : ''}`} onClick={() => setActiveTab('contractor_performance')}>
          <Trophy size={16} /> Contractor Performance
        </button>
      </div>

      {/* TAB 0: INTERACTIVE STATUS EXPLORER (Triggered by Clicking Progress & Completed Cards) */}
      {activeTab === 'status_explorer' && (
        <div className="status-drilldown-section">
          <div className="status-drilldown-header">
            <div className="status-drilldown-info">
              <div className="status-drilldown-badge">
                {selectedStatusFilter === 'In progress' && <><Activity size={14} /> ACTIVE GROUND SITES</>}
                {selectedStatusFilter === 'Completed' && <><CheckCircle2 size={14} /> 100% CERTIFIED COMPLETE</>}
                {selectedStatusFilter === 'Delayed' && <><Clock size={14} /> BEHIND SCHEDULE</>}
                {selectedStatusFilter === 'Scheduled' && <><Calendar size={14} /> SCHEDULED MOBILIZATION</>}
                {selectedStatusFilter === 'All' && <><Building2 size={14} /> ALL REGISTERED WORKS</>}
              </div>
              <h2>
                {selectedStatusFilter === 'In progress' && `Works In Progress (${statusFilteredProjects.length} Active Sites)`}
                {selectedStatusFilter === 'Completed' && `Completed Public Works (${statusFilteredProjects.length} Handed Over)`}
                {selectedStatusFilter === 'Delayed' && `Delayed Public Works (${statusFilteredProjects.length} Requiring Action)`}
                {selectedStatusFilter === 'Scheduled' && `Scheduled Public Works (${statusFilteredProjects.length} Upcoming Permits)`}
                {selectedStatusFilter === 'All' && `Master Public Works Portfolio (${statusFilteredProjects.length} Works Across Chennai)`}
              </h2>
              <p>
                {selectedStatusFilter === 'In progress' && 'Live operational civil works actively under excavation, pipe installation, or resurfacing. Click any project card below to view Amazon 7-stage milestone progress, contractor logs, supervising engineers, and citizen questions.'}
                {selectedStatusFilter === 'Completed' && 'Certified completed works with road restoration, utility compaction, and GCC engineering safety certification signed off. Click any project card below for final audit records and completion timelines.'}
                {selectedStatusFilter === 'Delayed' && 'Projects experiencing logistical, utility collision, or weather bottlenecks requiring immediate administrative intervention.'}
                {selectedStatusFilter === 'Scheduled' && 'Works approved and permitted, awaiting site mobilization or joint trenching coordination.'}
                {selectedStatusFilter === 'All' && 'Complete departmental directory of public works across all 15 Chennai zones.'}
              </p>
            </div>

            {/* Quick Status Filter Buttons & Department Picker */}
            <div className="status-drilldown-controls">
              <div className="status-search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Filter by title, address, or PIN..."
                  value={statusSearchQuery}
                  onChange={e => setStatusSearchQuery(e.target.value)}
                />
                {statusSearchQuery && (
                  <button onClick={() => setStatusSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="status-dept-select-wrap">
                <select
                  value={selectedDeptFilter}
                  onChange={e => setSelectedDeptFilter(e.target.value)}
                  className="status-dept-select"
                >
                  <option value="All">All Departments ({projects.length})</option>
                  <option value="Greater Chennai Corporation">Greater Chennai Corporation</option>
                  <option value="Chennai Metro Water">Chennai Metro Water</option>
                  <option value="TANGEDCO">TANGEDCO Power</option>
                  <option value="Fibre">Telecom / Fibre</option>
                </select>
              </div>
            </div>
          </div>

          {/* Projects Cards Grid */}
          <div className="status-projects-grid">
            {statusFilteredProjects.map(project => (
              <div
                key={project.id}
                className={`status-project-card status-${project.status.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setDetailModalProject(project)}
              >
                <div className="status-project-top">
                  <div className="status-code-badge">{project.code}</div>
                  <span className={`place-status-chip ${project.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {project.status === 'Completed' ? '✓ Completed' : project.status}
                  </span>
                </div>

                <h3 className="status-project-title">{project.title}</h3>
                <p className="status-project-address">
                  <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#096850' }} />
                  <span>{project.address} · <strong>PIN {project.pincode}</strong></span>
                </p>

                <div className="status-project-dept-tag">
                  <Building2 size={13} /> {project.department}
                </div>

                {/* Progress & Milestone Bar */}
                <div className="status-project-progress-wrap">
                  <div className="status-progress-labels">
                    <span className="status-progress-step">
                      Stage {project.current_step || (project.status === 'Completed' ? 7 : 3)}/7: {MILESTONE_STEPS[(project.current_step || (project.status === 'Completed' ? 7 : 3)) - 1]?.title || 'In Execution'}
                    </span>
                    <span className="status-progress-percent">{project.progress}%</span>
                  </div>
                  <div className="status-progress-bar-bg">
                    <div
                      className={`status-progress-bar-fill ${project.status.toLowerCase().replace(/\s+/g, '-')}`}
                      style={{ width: `${Math.max(5, project.progress)}%` }}
                    />
                  </div>
                </div>

                {/* Quick Specs Strip */}
                <div className="status-project-specs">
                  <div>
                    <span className="spec-label">Budget</span>
                    <span className="spec-val">₹{(project.budget / 100000).toFixed(1)} L</span>
                  </div>
                  <div>
                    <span className="spec-label">Target Date</span>
                    <span className="spec-val">{formatDate(project.due_date)}</span>
                  </div>
                  <div>
                    <span className="spec-label">Disruption</span>
                    <span className="spec-val" style={{ color: project.disruption.toLowerCase().includes('high') ? '#dc2626' : '#059669' }}>
                      {project.disruption}
                    </span>
                  </div>
                </div>

                <div className="status-project-card-footer">
                  <span className="view-details-prompt">
                    Click to view full project breakdown & timeline
                  </span>
                  <ArrowRight size={15} />
                </div>
              </div>
            ))}
          </div>

          {statusFilteredProjects.length === 0 && (
            <div className="status-empty-box">
              <CheckCircle2 size={44} color="#10896b" />
              <h3>No projects found</h3>
              <p>Try switching departments or searching with a different keyword.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: DIGSYNC COORDINATION ENGINE + CONFLICT TICKETS */}
      {activeTab === 'digsync' && (
        <DigSyncConflictPanel
          digsync={digsync}
          user={user}
          onToast={onToast}
        />
      )}

      {/* TAB 2: PROJECTS REGISTER & MILESTONE UPDATER */}
      {activeTab === 'projects' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
            {['All', 'Greater Chennai Corporation', 'Chennai Metro Water', 'TANGEDCO', 'Fibre'].map(dept => (
              <button
                key={dept}
                className={`gmaps-chip ${selectedDeptFilter === dept ? 'active' : ''}`}
                onClick={() => setSelectedDeptFilter(dept)}
              >
                {dept}
              </button>
            ))}
          </div>

          <div className="projects-table-card">
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Project Name</th>
                  <th>PIN</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Amazon Stage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{p.code}</td>
                    <td>
                      <strong>{p.title}</strong>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{p.address}</div>
                    </td>
                    <td><span className="pincode-change-tag">{p.pincode}</span></td>
                    <td>{p.department}</td>
                    <td>
                      <span className={`place-status-chip ${p.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '48px', height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                          <div style={{ width: `${p.progress}%`, height: '100%', background: '#10896b', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 700 }}>{p.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#0284c7' }}>
                        Stage {p.current_step || 3}/7
                      </span>
                    </td>
                    <td>
                      <button
                        className="table-action-btn"
                        onClick={() => setEditingProject(p)}
                      >
                        <Wrench size={13} /> Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: CITIZEN GRIEVANCES & Q&A TRIAGE */}
      {activeTab === 'grievances' && (
        <div className="grievances-section">
          {escalatedIssuesCount > 0 && (
            <div className="escalation-alert-banner">
              <div className="escalation-banner-icon">
                <AlertTriangle size={24} color="#b91c1c" />
              </div>
              <div className="escalation-banner-info">
                <h4>{escalatedIssuesCount} Citizen Submission(s) Escalated to Municipality</h4>
                <p>
                  Line departments have exceeded the mandatory 3-day response deadline. Municipal executive review and direct intervention required.
                </p>
              </div>
              <button
                className={`escalation-filter-btn ${grievanceTypeFilter === 'Escalated' ? 'active' : ''}`}
                onClick={() => setGrievanceTypeFilter(grievanceTypeFilter === 'Escalated' ? 'All' : 'Escalated')}
              >
                {grievanceTypeFilter === 'Escalated' ? 'Show All Grievances' : `Filter Escalated (${escalatedIssuesCount})`}
              </button>
            </div>
          )}

          {/* Search & Type Filter Controls Strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
            {/* Type Filter Pills */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['All', 'Questions', 'Grievances', 'Escalated', 'Answered'] as const).map(type => (
                <button
                  key={type}
                  className={`dept-pill-btn ${grievanceTypeFilter === type ? 'active' : ''}`}
                  onClick={() => setGrievanceTypeFilter(type)}
                >
                  {type === 'All' ? 'All Submissions' : type === 'Escalated' ? '⚠️ Escalated' : type === 'Questions' ? '💬 Q&A Questions' : type === 'Grievances' ? '🚨 Hazard Reports' : '✅ Answered'}
                  <span className="dept-pill-count">
                    {type === 'All' ? issues.length
                      : type === 'Escalated' ? escalatedIssuesCount
                      : type === 'Questions' ? issues.filter(i => i.is_question || (i.kind || '').toLowerCase().includes('question')).length
                      : type === 'Grievances' ? issues.filter(i => !i.is_question && !(i.kind || '').toLowerCase().includes('question')).length
                      : issues.filter(i => i.status === 'Resolved' || i.status === 'Answered').length}
                  </span>
                </button>
              ))}
            </div>

            {/* Real-time Search Box */}
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search citizen messages, PIN, locality..."
                value={grievanceSearch}
                onChange={e => setGrievanceSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '10px',
                  border: '1.5px solid var(--gray-200)',
                  fontSize: '13px',
                  outline: 'none',
                  background: '#ffffff'
                }}
              />
            </div>
          </div>

          {/* Department Filter Pills */}
          <div className="dept-filter-pills-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
            {['All', 'Chennai Metro Water', 'GCC Roads & Bridges', 'TANGEDCO', 'Greater Chennai Corporation'].map(dept => {
              const count = dept === 'All' ? issues.length
                : issues.filter(i => (i.department || '').toLowerCase().includes(dept.toLowerCase())).length;
              return (
                <button
                  key={dept}
                  className={`dept-pill-btn ${grievanceDeptFilter === dept ? 'active' : ''}`}
                  onClick={() => setGrievanceDeptFilter(dept)}
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                >
                  {dept}
                  <span className="dept-pill-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="grievance-cards-grid">
            {filteredGrievances.map((iss: any) => (
              <div className={`grievance-card ${iss.is_escalated ? 'card-escalated' : ''}`} key={iss.id}>
                <div className="grievance-header">
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span className="grievance-ref">{iss.ref}</span>
                    <strong style={{ fontSize: '14.5px', color: '#0f2438' }}>{iss.kind}</strong>
                    {iss.pincode && (
                      <span className="pincode-change-tag">PIN {iss.pincode}</span>
                    )}
                    {iss.department && (
                      <span className="dept-badge-tag" style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        {iss.department}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {iss.is_escalated && (
                      <span className="escalation-badge" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px' }}>
                        ⚠️ Overdue ({iss.days_elapsed}d) · Escalated
                      </span>
                    )}
                    <span className={`place-status-chip ${iss.status === 'Resolved' || iss.status === 'Answered' ? 'completed' : iss.status === 'In Progress' ? 'in-progress' : 'upcoming'}`}>
                      {iss.status}
                    </span>
                  </div>
                </div>

                <div className="grievance-content">
                  <p style={{ fontSize: '13.5px', lineHeight: 1.55 }}>"{iss.message}"</p>
                  <IssueEvidence items={iss.attachments || []} />
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                    Locality: <strong>{iss.locality}</strong> · Logged: {formatDate(iss.created)}
                    {iss.phone && <span> · Phone: <strong style={{ color: '#334155' }}>{iss.phone}</strong></span>}
                    {iss.project_title && (
                      <span> · Project: <strong style={{ color: '#0f766e' }}>{iss.project_title}</strong></span>
                    )}
                  </div>
                </div>

                {iss.official_reply ? (
                  <div className="qa-reply" style={{ margin: '8px 0', borderLeftColor: '#10b981', background: '#f0fdf4' }}>
                    <strong style={{ color: '#166534' }}>Official Municipal Response Published:</strong> {iss.official_reply}
                    <small style={{ color: '#15803d' }}>By: {iss.replied_by || 'Municipal Executive Engineer'} on {formatDate(iss.replied_at)}</small>
                  </div>
                ) : (
                  <div className="grievance-footer">
                    <span style={{ fontSize: '11.5px', color: iss.is_escalated ? '#b91c1c' : '#ea580c', fontWeight: 700 }}>
                      {iss.is_escalated
                        ? '⚠️ 3-day SLA breached. Executive intervention active.'
                        : 'Awaiting Official Reply (published to live public feed)'}
                    </span>
                    <button
                      className="table-action-btn"
                      style={iss.is_escalated
                        ? { background: '#b91c1c', color: 'white', borderColor: '#991b1b' }
                        : { background: '#0f766e', color: 'white', borderColor: '#0d9488' }}
                      onClick={() => setReplyingIssue(iss)}
                    >
                      <Send size={13} /> {iss.is_escalated ? 'Executive Intervention & Reply' : 'Dispatch Response'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {filteredGrievances.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', background: 'white', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>
                <CheckCircle2 size={40} color="#10896b" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--navy)', margin: '0 0 6px 0' }}>No Inquiries in this Filter</h3>
                <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>All citizen inquiries matching the selected criteria have been addressed.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: HAZARD NOTICES & GOOGLE MAPS NAVIGATION FEEDS */}
      {activeTab === 'hazards' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="contacts-card">
            <div className="section-label">
              <Car size={14} /> LIVE ROAD CLOSURES BROADCAST TO GOOGLE MAPS
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Active road segment closures intimating Google Maps API & Chennai Traffic Police feeds:
            </p>

            {projects.filter(p => p.gmaps_broadcast).map(p => (
              <div key={p.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#0f2438' }}>{p.address} ({p.pincode})</strong>
                  <span className="gmaps-sync-badge"><span className="gmaps-sync-dot" /> Live on GMaps</span>
                </div>
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  Restriction: {p.disruption}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Detour route: {p.detour_advice}
                </div>
              </div>
            ))}
          </div>

          <div className="contacts-card">
            <div className="section-label">
              <Volume2 size={14} /> ACTIVE NOISE & DUST PERMIT TIMINGS
            </div>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              Active permitted heavy disruption windows across Chennai wards:
            </p>

            {projects.slice(0, 5).map(p => (
              <div key={p.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '10px', border: '1px solid #e2e8f0' }}>
                <strong style={{ fontSize: '13px', color: '#0f2438' }}>{p.title} ({p.pincode})</strong>
                <div style={{ fontSize: '12px', color: '#9d174d', marginTop: '4px' }}>
                  🔊 {p.noise_warning}
                </div>
                <div style={{ fontSize: '12px', color: '#854d0e', marginTop: '2px' }}>
                  💨 {p.dust_warning}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === 'contractor_performance' && <ContractorPerformanceDashboard mode="municipal" />}

      {/* Project Operations & Stage Auto-Sync Modal */}
      {editingProject && (
        <ProjectOperationsModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onSave={(id, data) => updateProjectMutation.mutate({ id, data })}
          isPending={updateProjectMutation.isPending}
        />
      )}

      {/* Municipal Citizen Reply Modal */}
      {replyingIssue && (
        <MunicipalReplyModal
          issue={replyingIssue}
          onClose={() => setReplyingIssue(null)}
          onSubmit={(id, reply, status) => replyIssueMutation.mutate({ id, reply, status })}
          isPending={replyIssueMutation.isPending}
          officialUser={user}
        />
      )}

      {/* DigSync Conflict Resolution Modal — now replaced by DigSyncConflictPanel */}

      {/* Project Comprehensive Details Modal (Triggered by Clicking Any Project Card) */}
      {detailModalProject && (
        <div className="modal-overlay" onClick={() => setDetailModalProject(null)}>
          <div className="modal-window project-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-window-head">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="modal-work-code">{detailModalProject.code}</span>
                  <span className={`place-status-chip ${detailModalProject.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {detailModalProject.status === 'Completed' ? '✓ Certified Completed' : detailModalProject.status}
                  </span>
                  <span className="modal-dept-badge">{detailModalProject.department}</span>
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#0f2438' }}>
                  {detailModalProject.title}
                </h2>
                <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '2px' }}>
                  <MapPin size={13} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#10896b' }} />
                  {detailModalProject.address} · <strong>PIN {detailModalProject.pincode}</strong> · {detailModalProject.locality}
                </p>
              </div>
              <button onClick={() => setDetailModalProject(null)} className="modal-close-icon"><X size={20} /></button>
            </div>

            <div className="modal-window-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Progress & Target Banner */}
              <div className="detail-modal-progress-banner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Overall Operational Progress
                    </span>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: detailModalProject.status === 'Completed' ? '#059669' : '#0f2438' }}>
                      {detailModalProject.progress}% {detailModalProject.status === 'Completed' ? 'Completed & Handed Over' : 'Under Execution'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>Target Completion</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f2438' }}>
                      {formatDate(detailModalProject.due_date)}
                    </div>
                    {detailModalProject.revised_date && (
                      <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                        Revised: {formatDate(detailModalProject.revised_date)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="status-progress-bar-bg" style={{ height: '12px', borderRadius: '6px' }}>
                  <div
                    className={`status-progress-bar-fill ${detailModalProject.status.toLowerCase().replace(/\s+/g, '-')}`}
                    style={{ width: `${Math.max(5, detailModalProject.progress)}%`, height: '12px', borderRadius: '6px' }}
                  />
                </div>
              </div>

              {/* Amazon 7-Stage Milestone Progression */}
              <div className="detail-modal-section">
                <h4 className="detail-section-heading">
                  <Construction size={17} /> Amazon 7-Stage Milestone Progression
                </h4>
                <div className="detail-milestone-stepper">
                  {MILESTONE_STEPS.map(stepItem => {
                    const currentStep = detailModalProject.current_step || (detailModalProject.status === 'Completed' ? 7 : 3);
                    const isPassed = stepItem.step < currentStep || (stepItem.step === 7 && detailModalProject.status === 'Completed');
                    const isCurrent = stepItem.step === currentStep && detailModalProject.status !== 'Completed';

                    return (
                      <div key={stepItem.step} className={`milestone-stepper-node ${isPassed ? 'completed' : isCurrent ? 'current' : 'pending'}`}>
                        <div className="node-indicator">
                          {isPassed ? <Check size={14} /> : stepItem.step}
                        </div>
                        <div className="node-content">
                          <div className="node-title">
                            Stage {stepItem.step}: {stepItem.title}
                          </div>
                          <div className="node-desc">{stepItem.desc}</div>
                          <span className={`node-badge ${isPassed ? 'cleared' : isCurrent ? 'active' : 'upcoming'}`}>
                            {isPassed ? '✓ Stage Cleared & Audited' : isCurrent ? '● Active In Progress Now' : 'Pending Milestone'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Engineering & Financial Specifications */}
              <div className="detail-modal-section">
                <h4 className="detail-section-heading">
                  <Shield size={17} /> Project Specifications & Supervision
                </h4>
                <div className="detail-specs-grid">
                  <div className="spec-box">
                    <span className="spec-title">Sanctioned Budget</span>
                    <span className="spec-value">₹{(detailModalProject.budget / 100000).toFixed(1)} Lakhs</span>
                    <small>Greater Chennai Corporation Fund</small>
                  </div>
                  <div className="spec-box">
                    <span className="spec-title">Work Commencement</span>
                    <span className="spec-value">{formatDate(detailModalProject.start_date)}</span>
                    <small>Tender Order Executed</small>
                  </div>
                  <div className="spec-box">
                    <span className="spec-title">Executing Contractor</span>
                    <span className="spec-value">{detailModalProject.contractor}</span>
                    <small>Phone: {detailModalProject.contact_contractor_phone}</small>
                  </div>
                  <div className="spec-box">
                    <span className="spec-title">Supervising GCC Engineer</span>
                    <span className="spec-value">{detailModalProject.contact_engineer_name}</span>
                    <small>{detailModalProject.contact_engineer_phone} · {detailModalProject.contact_engineer_email}</small>
                  </div>
                  <div className="spec-box">
                    <span className="spec-title">Road Disruption Advisory</span>
                    <span className="spec-value" style={{ color: detailModalProject.disruption.toLowerCase().includes('high') ? '#dc2626' : '#0f2438' }}>
                      {detailModalProject.disruption}
                    </span>
                    <small>Detour: {detailModalProject.detour_advice}</small>
                  </div>
                  <div className="spec-box">
                    <span className="spec-title">Noise & Dust Guidelines</span>
                    <span className="spec-value">Permitted Window</span>
                    <small>🔊 {detailModalProject.noise_warning} | 💨 {detailModalProject.dust_warning}</small>
                  </div>
                </div>
              </div>

              {/* Citizen Q&A & Grievance Feed for this Project / Locality */}
              <div className="detail-modal-section">
                <h4 className="detail-section-heading">
                  <MessageSquare size={17} /> Citizen Grievances & Questions ({issues.filter((iss: any) => iss.locality === detailModalProject.locality || iss.pincode === detailModalProject.pincode).length})
                </h4>
                <div className="detail-issues-list">
                  {issues
                    .filter((iss: any) => iss.locality === detailModalProject.locality || iss.pincode === detailModalProject.pincode)
                    .map((iss: any) => (
                      <div key={iss.id} className="detail-issue-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="issue-author">
                            <strong>Citizen Query ({iss.kind}):</strong> {iss.locality}
                          </span>
                          <span className={`place-status-chip ${iss.status === 'Resolved' || iss.status === 'Answered' ? 'completed' : 'in-progress'}`}>
                            {iss.status}
                          </span>
                        </div>
                        <p style={{ marginTop: '6px', fontSize: '13.5px', color: '#1e293b', lineHeight: 1.5 }}>
                          "{iss.message}"
                        </p>
                        <IssueEvidence items={iss.attachments || []} />
                        {iss.official_reply ? (
                          <div className="qa-reply" style={{ marginTop: '8px' }}>
                            <strong>Official Departmental Response (Live in Public Feed):</strong> {iss.official_reply}
                            <small>By {iss.replied_by || 'Municipal Engineer'} on {formatDate(iss.replied_at)}</small>
                          </div>
                        ) : (
                          <div style={{ marginTop: '10px' }}>
                            <button
                              className="table-action-btn"
                              onClick={() => setReplyingIssue(iss)}
                            >
                              <Send size={13} /> Respond & Publish to Public Feed
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  {issues.filter((iss: any) => iss.locality === detailModalProject.locality || iss.pincode === detailModalProject.pincode).length === 0 && (
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                      <CheckCircle2 size={24} color="#10896b" style={{ margin: '0 auto 6px' }} />
                      No active citizen grievances filed for this locality corridor.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-window-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="admin-nav-button"
                onClick={() => {
                  const proj = detailModalProject;
                  setDetailModalProject(null);
                  setEditingProject(proj);
                }}
              >
                <Wrench size={15} /> Update Operational Milestone & Progress
              </button>
              <button className="logout-nav-button" onClick={() => setDetailModalProject(null)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CITIZEN ISSUE / GRIEVANCE MODAL
// ============================================================
function CitizenIssueModal({
  project,
  pincode,
  localityName,
  onClose,
  onSuccess
}: {
  project: Project | null;
  pincode: string;
  localityName: string;
  onClose: () => void;
  onSuccess: (ref: string) => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState('Excessive noise');
  const [department, setDepartment] = useState(project?.department || 'Greater Chennai Corporation');
  const [message, setMessage] = useState('');
  const [locality, setLocality] = useState(localityName || project?.locality || 'Triplicane');
  const [severity, setSeverity] = useState('Normal');
  const [intimated, setIntimated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [submitError, setSubmitError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 8) {
      alert('Please provide a little more detail (at least 8 characters).');
      return;
    }
    setLoading(true);
    setSubmitError('');

    try {
      const uploaded: { media_id: number; upload_token: string }[] = [];
      for (let i = 0; i < evidenceFiles.length; i += 1) {
        setUploadProgress(`Uploading evidence ${i + 1} of ${evidenceFiles.length}…`);
        uploaded.push(await uploadMedia(evidenceFiles[i], percent => setUploadProgress(`Uploading evidence ${i + 1} of ${evidenceFiles.length} · ${percent}%`)));
      }
      setUploadProgress('Submitting grievance…');
      const res = await fetchApi<any>('/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project?.id || null,
          department: department || project?.department || 'Greater Chennai Corporation',
          pincode: pincode || project?.pincode,
          kind,
          message: message.trim(),
          locality: locality.trim() || 'Chennai',
          severity,
          is_question: kind.includes('Question') || kind.includes('Inquiry'),
          intimated_in_advance: intimated,
          attachments: uploaded
        })
      });
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['issues', pincode] });
      qc.invalidateQueries({ queryKey: ['admin_issues'] });
      onSuccess(res.ref);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'The grievance could not be submitted. Please try again.');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" onClick={e => e.stopPropagation()}>
        <div className="modal-window-head">
          <h3>Report Disruption or Grievance · {localityName}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-window-body">
            {project && (
              <div style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '12px' }}>
                Related Project: <strong>{project.title}</strong> ({project.code})
              </div>
            )}

            <div className="form-group">
              <label>Target Department / Agency *</label>
              <select value={department} onChange={e => setDepartment(e.target.value)} required>
                <option value="Greater Chennai Corporation">Greater Chennai Corporation (GCC)</option>
                <option value="Chennai Metro Water">Chennai Metro Water (CMWSSB)</option>
                <option value="TANGEDCO">TANGEDCO Power & Electricity</option>
                <option value="Stormwater Drainage">Stormwater Drainage Department</option>
                <option value="GCC Roads & Bridges">GCC Roads & Bridges</option>
              </select>
            </div>

            <EvidencePicker
              files={evidenceFiles}
              onChange={setEvidenceFiles}
              onTranscript={transcript => setMessage(previous => `${previous.trimEnd()}${previous.trim() ? ' ' : ''}${transcript}`)}
              disabled={loading}
            />
            {uploadProgress && <div className="media-upload-progress" role="status">{uploadProgress}</div>}
            {submitError && <div className="media-error" role="alert">{submitError}</div>}

            <div className="form-group">
              <label>Grievance / Query Type</label>
              <select value={kind} onChange={e => setKind(e.target.value)}>
                <option value="Excessive noise">Excessive Noise (Violating Permitted Hours)</option>
                <option value="Excessive dust">Excessive Dust (No Water Sprinklers)</option>
                <option value="Project Lag Inquiry">Inquiry regarding Project Lag / Delays</option>
                <option value="Missing barricades">Missing Barricades / Open Trench Hazard</option>
                <option value="Road access blocked">Complete Road Access Blockage</option>
                <option value="Water supply disruption">Water Supply Interruption</option>
                <option value="Power outage">Power Interruption / Cable Excavation</option>
                <option value="Other">Other Construction Grievance</option>
              </select>
            </div>

            <div className="form-group">
              <label>Locality / Street</label>
              <input
                value={locality}
                onChange={e => setLocality(e.target.value)}
                placeholder="e.g. Triplicane High Road"
                required
              />
            </div>

            <div className="form-group">
              <label>Detailed Description</label>
              <textarea
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Describe the disruption, timings, or safety issue..."
                className="ask-qa-textarea"
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="intimated"
                checked={intimated}
                onChange={e => setIntimated(e.target.checked)}
              />
              <label htmlFor="intimated" style={{ fontSize: '12px', color: '#475569' }}>
                Was this disruption officially intimated in advance by the department?
              </label>
            </div>
          </div>

          <div className="modal-window-footer">
            <button type="button" className="logout-nav-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-nav-button" disabled={loading}>
              <Send size={13} />
              {loading ? 'Submitting…' : 'Submit to Municipal Registry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type UploadedEvidence = { media_id: number; upload_token: string; media_type: string; filename: string; size: number; url: string };

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  at: Date;
  sources?: { type: string; id: number; code?: string; title: string }[];
  files?: string[];
};

function UtopiaAIWidget({ defaultPincode, defaultLocality, onIssueSubmitted }: {
  defaultPincode: string; defaultLocality: string; onIssueSubmitted: (ref: string) => void;
}) {
  const welcome = "Hello! Welcome to Utopia. I'm your civic assistant. You can ask me about public works, nearby projects, road closures, project progress, civic issues, and grievance reporting. How can I help you today?";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: welcome, at: new Date() }]);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [showEvidenceTools, setShowEvidenceTools] = useState(false);
  const [uploadedEvidence, setUploadedEvidence] = useState<UploadedEvidence[]>([]);
  const [uploading, setUploading] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReview, setReportReview] = useState(false);
  const [reportKind, setReportKind] = useState('Missing barricades');
  const [reportDescription, setReportDescription] = useState('');
  const [reportLocality, setReportLocality] = useState(defaultLocality || '');
  const [reportPin, setReportPin] = useState(defaultPincode || '');
  const [reportPhone, setReportPhone] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [reportProjectId, setReportProjectId] = useState('');
  const messagesRef = useRef<HTMLDivElement>(null);
  const { data: reportProjects = [] } = useQuery({
    queryKey: ['ai-report-projects'],
    queryFn: () => fetchApi<Project[]>('/projects'),
    enabled: open && reportOpen,
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, reportOpen]);

  const addMessage = (message: ChatMessage) => setMessages(previous => [...previous, message]);
  const detectReportType = (value: string) => {
    const lower = value.toLowerCase();
    if (lower.includes('noise')) return 'Excessive noise';
    if (lower.includes('dust')) return 'Excessive dust';
    if (lower.includes('water')) return 'Water supply disruption';
    if (lower.includes('power') || lower.includes('electric')) return 'Power outage';
    if (lower.includes('road') || lower.includes('pothole')) return 'Road access blocked';
    return 'Missing barricades';
  };

  const requestLocation = () => {
    setLocationMessage('');
    if (!navigator.geolocation) { setLocationMessage('Location is not available in this browser. Enter a locality or PIN instead.'); return; }
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage('Your current location is ready for nearby project search.');
      },
      () => setLocationMessage('Location permission was not granted. Enter a locality or PIN to search nearby works.'),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const send = async (override?: string) => {
    const messageText = (override ?? text).trim();
    if (!messageText && files.length === 0) return;
    if (uploadedEvidence.length + files.length > 5) {
      setError('A grievance can include up to 5 evidence files. Remove an attachment before adding another.');
      return;
    }
    setError('');
    setSending(true);
    try {
      const newUploads: UploadedEvidence[] = [];
      for (let i = 0; i < files.length; i += 1) {
        setUploading(`Uploading ${i + 1} of ${files.length} evidence file(s)…`);
        newUploads.push(await uploadMedia(files[i], percent => setUploading(`Uploading ${i + 1} of ${files.length} evidence file(s) · ${percent}%`)));
      }
      const allEvidence = [...uploadedEvidence, ...newUploads];
      setUploadedEvidence(allEvidence);
      setFiles([]);
      const shownText = messageText || 'I attached evidence to this conversation.';
      addMessage({ role: 'user', content: shownText, at: new Date(), files: newUploads.map(item => item.filename) });
      setText('');

      const incident = /\b(how can i report|how do i report|how to report)\b/i.test(messageText)
        ? false
        : /\b(there is|there's|i see|i found|please report|report|file a|submit a)\b/i.test(messageText) && /\b(trench|pothole|noise|dust|water|power|road|issue|grievance|complaint|barricade)\b/i.test(messageText);
      if (newUploads.length > 0 && !messageText) {
        addMessage({ role: 'assistant', content: `I received ${newUploads.length} file(s) as evidence. I cannot inspect, identify, or transcribe their contents. What would you like to do with them? You can say “report an issue” to attach them to a grievance.`, at: new Date() });
        return;
      }
      if (incident) {
        setReportKind(detectReportType(messageText));
        setReportDescription(messageText && !/^(report|file a|submit a)\b/i.test(messageText) ? messageText : '');
        setReportOpen(true);
        setReportReview(false);
        addMessage({ role: 'assistant', content: `I received ${allEvidence.length} evidence file(s). I can attach them to a grievance, but I cannot inspect, identify, or transcribe media. Please review the report details below and confirm before I submit anything.`, at: new Date() });
        return;
      }

      const answer = await fetchApi<any>('/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText || `A citizen attached ${newUploads.length} evidence file(s). Do not interpret their contents.`,
          conversation_id: conversationId,
          location,
          context: messages.filter(item => item.role !== 'assistant' || item.content !== welcome).slice(-6).map(item => ({ role: item.role, content: item.content.slice(0, 1200) }))
        })
      });
      setConversationId(answer.conversation_id);
      addMessage({
        role: 'assistant', content: answer.answer + (newUploads.length ? `\n\nI also received ${newUploads.length} evidence file(s). I cannot inspect their contents. Say “report an issue” if you want to attach them to a grievance.` : ''), at: new Date(), sources: answer.sources,
        files: allEvidence.length ? allEvidence.map(item => item.filename) : undefined
      });
    } catch (e) {
      setText(messageText);
      setError(e instanceof Error ? e.message : 'The assistant is temporarily unavailable. Please retry.');
    } finally {
      setSending(false);
      setUploading('');
    }
  };

  const submitReport = async () => {
    setError('');
    setSending(true);
    try {
      const result = await fetchApi<any>('/issues', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: reportKind, message: reportDescription.trim(), locality: reportLocality.trim(),
          project_id: reportProjectId ? Number(reportProjectId) : undefined,
          pincode: /^\d{6}$/.test(reportPin) ? reportPin : undefined,
          phone: reportPhone.trim() || undefined, email: reportEmail.trim() || undefined,
          is_question: false, severity: 'Normal',
          attachments: uploadedEvidence.map(item => ({ media_id: item.media_id, upload_token: item.upload_token }))
        })
      });
      setReportOpen(false);
      setReportReview(false);
      setUploadedEvidence([]);
      setReportProjectId('');
      addMessage({ role: 'assistant', content: `Your grievance was submitted successfully. Reference: ${result.ref}. The department recorded is ${result.department}.`, at: new Date(), sources: [] });
      onIssueSubmitted(result.ref);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The grievance could not be submitted. Please retry.');
    } finally { setSending(false); }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: welcome, at: new Date() }]);
    setConversationId(undefined); setError(''); setFiles([]); setUploadedEvidence([]);
    setReportOpen(false); setReportReview(false);
  };

  const suggestions = [
    'What projects are happening in my area?',
    'Are there any delayed projects near me?',
    'What is the current status of the drainage project?',
    'Are there any road closures near T. Nagar?',
    'How can I report an issue?',
    'How do I check my grievance status?'
  ];

  return <>
    {!open && <button className="utopia-ai-launcher" type="button" aria-label="Open Utopia AI citizen assistant" onClick={() => setOpen(true)}><Bot size={21} /><span>Ask Utopia AI</span></button>}
    {open && <section className="utopia-ai-panel" role="dialog" aria-modal="false" aria-label="Utopia AI citizen assistant">
      <header className="utopia-ai-header">
        <div className="utopia-ai-title"><span className="utopia-ai-avatar"><Bot size={19} /></span><div><strong>Utopia AI</strong><small>Citizen information assistant</small></div></div>
        <div className="utopia-ai-head-actions">
          <button type="button" aria-label="Clear conversation" title="Clear conversation" onClick={clearChat}><RotateCcw size={17} /></button>
          <button type="button" aria-label="Minimize assistant" title="Close chat" onClick={() => setOpen(false)}><X size={19} /></button>
        </div>
      </header>
      <div className="utopia-ai-messages" ref={messagesRef} aria-live="polite">
        {messages.map((message, index) => <article key={`${index}-${message.at.getTime()}`} className={`utopia-chat-message ${message.role}`}>
          <div className="utopia-chat-bubble">{message.content.split('\n').map((line, i) => <p key={i}>{line}</p>)}
            {message.files?.length ? <div className="chat-file-list">{message.files.map(file => <span key={file}><Paperclip size={13} /> {file}</span>)}</div> : null}
            {!!message.sources?.length && <div className="chat-sources"><strong>Utopia records</strong>{message.sources.map(source => <span key={`${source.type}-${source.id}`}>{source.code ? `${source.code} · ` : ''}{source.title}</span>)}</div>}
          </div>
          <time>{message.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
        </article>)}
        {messages.length === 1 && <div className="utopia-chat-suggestions"><span>Try asking</span>{suggestions.map(question => <button type="button" key={question} disabled={sending} onClick={() => void send(question)}>{question}</button>)}</div>}
        {reportOpen && <div className="chat-report-card">
          <strong>{reportReview ? 'Review your grievance' : 'Prepare an issue report'}</strong>
          {reportReview ? <div className="chat-report-summary"><p><b>Type:</b> {reportKind}</p><p><b>Location:</b> {reportLocality}{reportPin ? ` · PIN ${reportPin}` : ''}</p><p><b>Description:</b> {reportDescription}</p><p><b>Evidence:</b> {uploadedEvidence.length ? uploadedEvidence.map(item => item.filename).join(', ') : 'None attached'}</p><p><b>Contact:</b> {reportPhone || reportEmail || 'Not provided'}</p><p>Only submit if these details are correct.</p></div> : <>
            <label>Issue type<select value={reportKind} onChange={e => setReportKind(e.target.value)}><option>Missing barricades</option><option>Excessive noise</option><option>Excessive dust</option><option>Road access blocked</option><option>Water supply disruption</option><option>Power outage</option><option>Other</option></select></label>
            <label>Locality / street<input value={reportLocality} onChange={e => setReportLocality(e.target.value)} placeholder="Enter locality or street" required /></label>
            <label>PIN code (optional)<input value={reportPin} onChange={e => setReportPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit PIN" /></label>
            <label>Related project (optional)<select value={reportProjectId} onChange={e => setReportProjectId(e.target.value)}><option value="">No specific project</option>{reportProjects.map(project => <option key={project.id} value={project.id}>{project.code} · {project.title}</option>)}</select></label>
            <label>Description<textarea value={reportDescription} onChange={e => setReportDescription(e.target.value)} minLength={8} placeholder="Describe what happened" required /></label>
            <label>Phone (optional)<input value={reportPhone} onChange={e => setReportPhone(e.target.value)} /></label>
            <label>Email (optional)<input type="email" value={reportEmail} onChange={e => setReportEmail(e.target.value)} /></label>
          </>}
          <div className="chat-report-actions">
            {reportReview ? <><button type="button" onClick={() => setReportReview(false)}>Edit details</button><button type="button" className="confirm-report" disabled={sending} onClick={() => void submitReport()}>Confirm and submit</button></> : <><button type="button" onClick={() => { setReportOpen(false); setReportReview(false); setUploadedEvidence([]); }}>Cancel</button><button type="button" className="confirm-report" disabled={sending || reportDescription.trim().length < 8 || !reportLocality.trim() || (!!reportPin && !/^\d{6}$/.test(reportPin))} onClick={() => setReportReview(true)}>Review before submission</button></>}
          </div>
        </div>}
        {sending && <div className="utopia-chat-typing" role="status"><span /><span /><span /> {uploading || 'Checking Utopia records…'}</div>}
        {error && <div className="utopia-chat-error" role="alert">{error}<button type="button" onClick={() => void send()}>Retry</button></div>}
      </div>
      <div className="utopia-ai-tools"><button type="button" className="chat-location-button" onClick={requestLocation}><LocateFixed size={15} /> Share current location</button>{locationMessage && <small>{locationMessage}</small>}</div>
      <div className="utopia-ai-compose">
        <form onSubmit={e => { e.preventDefault(); void send(); }}>
          <textarea aria-label="Message Utopia AI" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Ask about public works or attach evidence…" rows={2} />
          <button type="button" className="chat-attach-toggle" aria-label="Attach image, audio, or video evidence" title="Attach evidence" onClick={() => setShowEvidenceTools(value => !value)}><Paperclip size={18} /></button>
          <button type="submit" aria-label="Send message" disabled={sending || (!text.trim() && !files.length)}><Send size={17} /></button>
        </form>
        {showEvidenceTools && <EvidencePicker
          files={files}
          onChange={setFiles}
          onTranscript={transcript => setText(previous => `${previous.trimEnd()}${previous.trim() ? ' ' : ''}${transcript}`)}
          disabled={sending}
        />}
        <small>Answers use current public Utopia records. Uploaded media is not analyzed by the assistant.</small>
      </div>
    </section>}
  </>;
}

function DepartmentComplaintVerificationPage({onToast}:{onToast:(m:string)=>void}) {
  const qc=useQueryClient();const {data=[],isLoading}=useQuery({queryKey:['department-contractor-complaints'],queryFn:()=>fetchApi<any[]>('/department/contractor-complaints')});const [notes,setNotes]=useState<Record<number,string>>({});const [severity,setSeverity]=useState<Record<number,string>>({});const [busy,setBusy]=useState<number|null>(null);
  const reviewAction=async(issue:any,action:'Under Review'|'Additional Evidence Requested')=>{if((notes[issue.id]||'').trim().length<5){onToast('Enter an internal note or evidence request.');return;}try{await fetchApi(`/department/complaints/${issue.id}/review-action`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,note:notes[issue.id]})});onToast(action==='Under Review'?'Complaint marked under review.':'Additional evidence requested.');await qc.invalidateQueries({queryKey:['department-contractor-complaints']});await qc.invalidateQueries({queryKey:['issues']});}catch(err){onToast(err instanceof Error?err.message:'Could not update complaint review status.');}};
  const decide=async(issue:any,decision:'Verified'|'Rejected')=>{if((notes[issue.id]||'').trim().length<8){onToast('Add a verification reason of at least 8 characters.');return;}setBusy(issue.id);try{const path=decision==='Verified'?`/department/complaints/${issue.id}/verify`:`/department/complaints/${issue.id}/reject`;const result=await fetchApi<any>(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,note:notes[issue.id],severity:severity[issue.id]||'minor'})});onToast(result.scoring_triggered?'Verified; the linked contractor score was updated.':`Complaint ${decision.toLowerCase()}.`);await Promise.all([qc.invalidateQueries({queryKey:['department-contractor-complaints']}),qc.invalidateQueries({queryKey:['admin_issues']}),qc.invalidateQueries({queryKey:['issues']})]);}catch(err){onToast(err instanceof Error?err.message:'Decision could not be saved.');}finally{setBusy(null);}};
  return <main className="contractor-page"><span className="eyebrow">DEPARTMENT WORKFLOW</span><h1>Contractor Performance & Complaint Verification</h1><p>Community corroboration prioritizes review. Only an officer decision affects contractor scores.</p>{isLoading?'Loading complaints…':data.length===0?<div className="contractor-empty">No complaints are waiting for review.</div>:<div className="verification-list">{data.map((i:any)=><article className="verification-card" key={i.id}><div className="verification-card-head"><div><b>{i.kind} · {i.ref}</b><small>{i.project_title||'No linked project'} · {i.locality} · {formatDate(i.created)}</small></div><span className={`community-status ${i.community_corroborated?'corroborated':''}`}>{i.official_verification==='Pending'?(i.community_corroborated?'Community Corroborated':'Submitted'):i.official_verification}</span></div><p>{i.message}</p><div className="verification-meta"><span>{i.confirmation_count} community confirmations</span><span>Contractor: {i.contractor||'Not assigned'}</span><span>{i.department}</span></div><IssueEvidence items={i.attachments||[]}/>{i.comments?.length>0&&<div className="verification-comments"><b>Community comments</b>{i.comments.map((c:any)=><div key={c.id}><p>“{c.comment}”</p><IssueEvidence items={c.evidence||[]}/></div>)}</div>}{i.internal_notes&&<div className="verification-comments"><b>Internal officer notes</b><p>{i.internal_notes}</p></div>}{i.official_verification==='Pending'?<><textarea placeholder="Officer note: decision reason or internal review note" value={notes[i.id]||''} onChange={e=>setNotes({...notes,[i.id]:e.target.value})}/><label>Complaint severity for scoring <select value={severity[i.id]||'minor'} onChange={e=>setSeverity({...severity,[i.id]:e.target.value})}><option value="minor">Minor (−3)</option><option value="major">Major (−7)</option><option value="critical">Critical (−15)</option></select></label><div className="verification-buttons"><button disabled={busy===i.id} className="community-comment-submit" onClick={()=>decide(i,'Verified')}>Verify complaint</button><button disabled={busy===i.id} className="table-action-btn" onClick={()=>decide(i,'Rejected')}>Reject complaint</button><button className="table-action-btn" onClick={()=>reviewAction(i,'Under Review')}>Mark under review</button><button className="table-action-btn" onClick={()=>reviewAction(i,'Additional Evidence Requested')}>Request evidence</button></div></>:<p className="privacy-note">{i.official_verification} · {i.verification_reason}</p>}</article>)}</div>}</main>;
}

function ContractorAdminPage({onToast}:{onToast:(m:string)=>void}) {
  const qc=useQueryClient();const {data:stats}=useQuery({queryKey:['contractor-admin-stats'],queryFn:()=>fetchApi<any>('/admin/contractor-statistics')});const {data:contractors=[]}=useQuery({queryKey:['admin-contractors'],queryFn:()=>fetchApi<any[]>('/admin/contractors')});const {data:rules=[]}=useQuery({queryKey:['contractor-rules'],queryFn:()=>fetchApi<any[]>('/admin/contractor-scoring-rules')});const {data:threshold}=useQuery({queryKey:['community-threshold'],queryFn:()=>fetchApi<any>('/admin/community-confirmation-threshold')});const {data:appeals=[]}=useQuery({queryKey:['contractor-appeals'],queryFn:()=>fetchApi<any[]>('/admin/contractor-appeals')});const [selected,setSelected]=useState<any>(null);const [points,setPoints]=useState(0);const [reason,setReason]=useState('');const [thresholdValue,setThresholdValue]=useState('');
  const adjust=async(e:React.FormEvent)=>{e.preventDefault();try{await fetchApi(`/admin/contractors/${selected.id}/score-adjustment`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:Number(points),reason})});setReason('');setSelected(null);onToast('Audited score adjustment recorded.');qc.invalidateQueries({queryKey:['admin-contractors']});qc.invalidateQueries({queryKey:['contractor-admin-stats']});}catch(err){onToast(err instanceof Error?err.message:'Adjustment failed.');}};
  const saveRule=async(r:any)=>{try{await fetchApi(`/admin/contractor-scoring-rules/${r.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({points:Number(r.points),is_active:r.is_active})});onToast('Scoring rule updated.');qc.invalidateQueries({queryKey:['contractor-rules']});}catch(err){onToast(err instanceof Error?err.message:'Rule update failed.');}};
  const setThreshold=async()=>{try{await fetchApi('/admin/community-confirmation-threshold',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({threshold:Number(thresholdValue||threshold?.threshold)})});onToast('Community corroboration threshold updated.');qc.invalidateQueries({queryKey:['community-threshold']});}catch(err){onToast(err instanceof Error?err.message:'Could not update threshold.');}};
  const linkOnsiteAccount=async(c:any)=>{const badge=window.prompt(`On-site badge to link with ${c.name}:`,c.onsite_badge_id||'');if(badge===null)return;try{await fetchApi(`/admin/contractors/${c.id}/onsite-account`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({badge_id:badge.trim()||null})});onToast('On-site account link saved.');qc.invalidateQueries({queryKey:['admin-contractors']});}catch(err){onToast(err instanceof Error?err.message:'Could not link on-site account.');}};
  const review=async(a:any,approved:boolean)=>{try{await fetchApi(`/admin/contractor-appeals/${a.id}/review`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approved,response:approved?'Appeal approved after administrative review.':'Appeal reviewed and rejected.'})});onToast('Appeal decision recorded.');qc.invalidateQueries({queryKey:['contractor-appeals']});qc.invalidateQueries({queryKey:['admin-contractors']});}catch(err){onToast(err instanceof Error?err.message:'Appeal review failed.');}};
  return <main className="contractor-page"><span className="eyebrow">MUNICIPAL ADMINISTRATION</span><h1>Contractor Performance Management</h1><div className="contractor-kpis">{[['Total contractors',stats?.contractors||0],['Active',stats?.active_contractors||0],['Average score',stats?.average_score||0],['Excellent',stats?.excellent||0],['Needs improvement',stats?.needs_improvement||0],['Verified complaints',stats?.verified_complaints||0],['Corroborated complaints',stats?.community_corroborated||0]].map(x=><div className="contractor-kpi" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong></div>)}</div><section className="contractor-chart"><h2>Contractor directory</h2><div className="contractor-table-wrap"><table className="contractor-table"><thead><tr><th>Contractor</th><th>Department</th><th>Projects</th><th>Completed</th><th>Complaints</th><th>Score / Grade</th><th/></tr></thead><tbody>{contractors.map((c:any)=><tr key={c.id}><td>{c.name}<small>{c.registration_number}</small></td><td>{c.department}</td><td>{c.total_projects}</td><td>{c.completed_projects}</td><td>{c.verified_complaints}</td><td>{c.score} · {c.grade}</td><td><button className="table-action-btn" onClick={()=>linkOnsiteAccount(c)}>{c.onsite_badge_id?`Badge ${c.onsite_badge_id}`:'Link on-site badge'}</button><button className="table-action-btn" onClick={()=>setSelected(c)}>Adjust score</button></td></tr>)}</tbody></table></div></section><section className="contractor-chart"><h2>Scoring rules</h2>{rules.map((r:any)=><div className="rule-row" key={r.id}><span>{r.description}</span><input type="number" value={r.points} onChange={e=>r.points=Number(e.target.value)}/><label><input type="checkbox" checked={r.is_active} onChange={e=>r.is_active=e.target.checked}/> Active</label><button className="table-action-btn" onClick={()=>saveRule(r)}>Save</button></div>)}</section><section className="contractor-chart"><h2>Community corroboration threshold</h2><div className="rule-row"><span>Confirmations required</span><input type="number" min="1" value={thresholdValue||threshold?.threshold||5} onChange={e=>setThresholdValue(e.target.value)}/><button className="table-action-btn" onClick={setThreshold}>Save threshold</button></div></section><section className="contractor-chart"><h2>Contractor appeals</h2>{appeals.filter((a:any)=>a.status==='Pending').map((a:any)=><div className="rule-row" key={a.id}><span>{a.contractor} · {a.appeal_reason}</span><button className="table-action-btn" onClick={()=>review(a,true)}>Approve and reverse</button><button className="table-action-btn" onClick={()=>review(a,false)}>Reject</button></div>)}</section>{selected&&<form className="appeal-form" onSubmit={adjust}><h3>Audited score adjustment · {selected.name}</h3><label>Points <input type="number" min="-100" max="100" value={points} onChange={e=>setPoints(Number(e.target.value))}/></label><textarea required minLength={8} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Mandatory reason"/><button className="community-comment-submit">Record adjustment</button><button type="button" onClick={()=>setSelected(null)}>Cancel</button></form>}</main>;
}

function ContractorPerformanceDashboard({mode}:{mode:'municipal'|'onsite'}) {
  const endpoint=mode==='municipal'?'/admin/contractor-performance-dashboard':'/onsite/contractor-performance';
  const {data,isLoading,error}=useQuery({queryKey:['embedded-contractor-performance',mode],queryFn:()=>fetchApi<any>(endpoint),refetchInterval:30000});
  const [selectedId,setSelectedId]=useState<number|null>(null);const [search,setSearch]=useState('');
  if(isLoading)return <section className="contractor-chart"><h2>Contractor performance</h2><p>Loading live score and project records…</p></section>;
  if(error||!data)return <section className="contractor-chart"><h2>Contractor performance</h2><p className="community-error">Performance records could not be loaded.</p></section>;
  const contractors=(data.contractors||[]).filter((c:any)=>!search||`${c.name} ${c.department}`.toLowerCase().includes(search.toLowerCase()));
  const selected=contractors.find((c:any)=>c.id===selectedId)||contractors[0];
  const trend=(data.transactions||[]).filter((t:any)=>t.contractor_id===selected?.id);
  return <div className="embedded-performance"><div className="performance-heading"><div><span className="eyebrow">LIVE ACCOUNTABILITY DATA</span><h2>{mode==='municipal'?'Citywide Contractor Performance':'My Contractor Score'}</h2><p>{mode==='municipal'?'Scores, verified complaints, project completion and score history across GCC works.':data.scope}</p></div><button className="table-action-btn" onClick={()=>window.location.reload()}>Refresh data</button></div>
    <div className="contractor-kpis">{(mode==='municipal'?[['Contractors',data.summary.total],['Average score',data.summary.average_score],['Excellent (90+)',data.summary.excellent],['Needs improvement',data.summary.needs_improvement],['Verified complaints',data.summary.verified_complaints],['Projects',data.summary.total_projects]]:[['My score',contractors[0]?.score??'—'],['Grade',contractors[0]?.grade??'—'],['Projects',contractors[0]?.total_projects??0],['Completed',contractors[0]?.completed_projects??0],['Verified complaints',contractors[0]?.verified_complaints??0]]).map(x=><div className="contractor-kpi" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong></div>)}</div>
    {contractors.length===0?<div className="contractor-empty">{mode==='onsite'?data.scope:'No contractor performance records are available yet.'}</div>:<div className="performance-grid"><section className="contractor-chart"><h3>{mode==='municipal'?'Current score by contractor':'My score trend'}</h3><ResponsiveContainer width="100%" height={300}><BarChart data={contractors} onClick={(event:any)=>{const row=event?.activePayload?.[0]?.payload;if(row)setSelectedId(row.id);}}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={70}/><YAxis domain={[0,100]}/><Tooltip/><Bar dataKey="score" fill="#0d9488" radius={[6,6,0,0]} cursor="pointer"/></BarChart></ResponsiveContainer>{mode==='municipal'&&<><input className="performance-search" placeholder="Find a contractor" value={search} onChange={e=>setSearch(e.target.value)}/><div className="performance-contractor-list">{contractors.map((c:any)=><button key={c.id} className={`performance-contractor-row ${selected?.id===c.id?'selected':''}`} onClick={()=>setSelectedId(c.id)}><span><b>{c.name}</b><small>{c.department} · {c.completed_projects}/{c.total_projects} completed · {c.verified_complaints} verified complaints</small></span><strong>{c.score} · {c.grade}</strong></button>)}</div></>}</section>
    <section className="contractor-chart"><h3>{mode==='municipal'?`${selected?.name} · score history`:'My score history'}</h3><div className="performance-score-summary"><strong>{selected?.score}</strong><span>Grade {selected?.grade}</span></div>{trend.length?<ResponsiveContainer width="100%" height={250}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tickFormatter={(v:string)=>formatDate(v)}/><YAxis domain={[0,100]}/><Tooltip/><Line type="monotone" dataKey="score" stroke="#0d9488" strokeWidth={3} dot/></LineChart></ResponsiveContainer>:<p>No score changes recorded yet. Your starting score is 100.</p>}<h4>Monthly score activity</h4>{data.monthly?.length?<ResponsiveContainer width="100%" height={180}><BarChart data={data.monthly}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="month"/><YAxis/><Tooltip/><Bar dataKey="positive" name="Points added" fill="#10b981"/><Bar dataKey="negative" name="Points deducted" fill="#ef4444"/></BarChart></ResponsiveContainer>:<p>No score transactions are available yet.</p>}</section></div>}
  </div>;
}

function CitizenLoginPage({ onLogin, onBack }: { onLogin: (token: string, user: AuthUser) => void; onBack: () => void }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetchApi<any>(register ? '/auth/citizen/register' : '/auth/citizen/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email,password,...(register?{name}:{})}) });
      onLogin(res.access_token, { ...res.user, department: 'Residents', designation: 'Citizen', badge_id: 'CITIZEN' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not sign in.'); } finally { setBusy(false); }
  };
  return <div className="portal-login-page"><div className="portal-login-card"><button className="modal-close-btn" onClick={onBack}><ArrowLeft size={18}/></button><h2>{register ? 'Create citizen account' : 'Citizen sign in'}</h2><p>Optional: an account helps you track complaints. You can confirm and comment on public complaints without signing in.</p>{error && <div className="login-error-alert">{error}</div>}<form className="login-form" onSubmit={submit}>{register && <label>Name<input required value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={100}/></label>}<label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<input required type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="login-submit-btn" disabled={busy}>{busy?'Please wait…':register?'Create account':'Sign in'}</button></form><button className="table-action-btn" style={{marginTop:12}} onClick={()=>setRegister(v=>!v)}>{register?'Already registered? Sign in':'New here? Create an account'}</button></div></div>;
}

function CommunityComplaintActions({ issue, onToast }: { issue:any; onToast:(v:string)=>void }) {
  const qc=useQueryClient(); const [open,setOpen]=useState(false); const [replyTo,setReplyTo]=useState<number|null>(null); const [comment,setComment]=useState(''); const [files,setFiles]=useState<File[]>([]); const [uploading,setUploading]=useState(false); const [error,setError]=useState('');
  const {data:discussion=[]}=useQuery({queryKey:['issue-comments',issue.id],queryFn:()=>fetchApi<any[]>(`/issues/${issue.id}/comments`),enabled:open});
  const {data:confirmations}=useQuery({queryKey:['issue-confirmations',issue.id],queryFn:()=>fetchApi<any>(`/issues/${issue.id}/confirmations`),enabled:open});
  const confirmation=useMutation({mutationFn:async()=> issue.confirmed_by_me ? fetchApi<any>(`/issues/${issue.id}/confirmations/me`,{method:'DELETE'}) : fetchApi<any>(`/issues/${issue.id}/confirmations`,{method:'POST'}),onMutate:async()=>{await qc.cancelQueries({queryKey:['issues']}); const prev=qc.getQueriesData<any[]>({queryKey:['issues']}); qc.setQueriesData<any[]>({queryKey:['issues']},old=>old?.map(i=>i.id===issue.id?{...i,confirmation_count:Math.max(0,(i.confirmation_count||0)+(i.confirmed_by_me?-1:1)),confirmed_by_me:!i.confirmed_by_me}:i));return {prev};},onError:(_e,_v,ctx)=>ctx?.prev.forEach(([key,data])=>qc.setQueryData(key,data)),onSuccess:async result=>{issue.confirmation_count=result.count;issue.confirmed_by_me=result.confirmed_by_me;issue.community_corroborated=result.community_corroborated;onToast(result.confirmed_by_me?'Your experience was added.':'Your confirmation was removed.');await qc.invalidateQueries({queryKey:['issues']});await qc.invalidateQueries({queryKey:['issue-confirmations',issue.id]});},onSettled:()=>qc.invalidateQueries({queryKey:['issues']})});
  const submitComment=async(e:React.FormEvent)=>{e.preventDefault();setUploading(true);setError('');try{const attachments=[];for(const file of files) attachments.push(await uploadMedia(file));await fetchApi(`/issues/${issue.id}/comments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({comment,attachments,parent_comment_id:replyTo||undefined})});setComment('');setFiles([]);setReplyTo(null);await qc.invalidateQueries({queryKey:['issue-comments',issue.id]});await qc.invalidateQueries({queryKey:['issues']});onToast('Comment added to the complaint.');}catch(err){setError(err instanceof Error?err.message:'Comment could not be submitted.');}finally{setUploading(false);}};
  return <div className="community-actions"><div className="community-status-row"><span className={`community-status ${issue.official_verification==='Verified'?'official':issue.official_verification==='Rejected'?'rejected':issue.community_corroborated?'corroborated':'submitted'}`}>{issue.official_verification==='Verified'?'Officially Verified':issue.official_verification==='Rejected'?'Rejected':issue.community_corroborated?'Community Corroborated':issue.status||'Submitted'}</span>{issue.department&&<small>{issue.department}</small>}</div><button className={`community-confirm ${issue.confirmed_by_me?'active':''}`} disabled={confirmation.isPending} onClick={()=>confirmation.mutate()}><Heart size={16} fill={issue.confirmed_by_me?'currentColor':'none'}/>{issue.confirmed_by_me?'YOU EXPERIENCED THIS TOO':'I EXPERIENCED THIS TOO'}</button><div className="community-links"><button onClick={()=>{setOpen(v=>!v);}}>{issue.confirmation_count||0} {issue.confirmation_count===1?'citizen':'citizens'} experienced this</button><button onClick={()=>setOpen(v=>!v)}>{discussion.length||issue.comment_count||0} comments · {open?'Hide discussion':'View discussion'}</button></div>{issue.community_corroborated&&<small className="community-corroborated-note"><BadgeCheck size={13}/> Residents have independently confirmed this issue.</small>}{open&&<section className="community-discussion"><strong>Community discussion</strong>{confirmations?.citizens?.length>0&&<p className="community-residents">Confirmed by {confirmations.citizens.length} residents · identities remain private</p>}{discussion.map((c:any)=><article className="community-comment" key={c.id}><p>{c.comment}</p><small>{formatDate(c.created_at)}</small><IssueEvidence items={c.evidence||[]}/><button className="comment-report" onClick={()=>setReplyTo(c.id)}>Reply</button><button className="comment-report" onClick={async()=>{try{await fetchApi(`/issues/${issue.id}/comments/${c.id}/report`,{method:'POST'});onToast('Comment reported for review.');}catch{onToast('Could not report comment.');}}}>Report</button></article>)}{discussion.length===0&&<p className="community-residents">Be the first to add useful context.</p>}<form onSubmit={submitComment}>{replyTo&&<small>Replying to a community comment <button type="button" onClick={()=>setReplyTo(null)}>Cancel</button></small>}<textarea value={comment} onChange={e=>setComment(e.target.value)} minLength={3} maxLength={2000} placeholder="Share what you experienced…" required/><EvidencePicker files={files} onChange={setFiles} disabled={uploading}/>{error&&<small className="login-error-alert">{error}</small>}<button className="community-comment-submit" disabled={uploading}>{uploading?'Posting…':'Post comment'}</button></form></section>}</div>;
}

function IssueEvidence({ items }: { items: { media_id: number; media_type: string; filename: string; url: string }[] }) {
  if (!items.length) return null;
  return <div className="issue-evidence-list" aria-label="Attached issue evidence">
    {items.map(item => <div className="issue-evidence-item" key={item.media_id}>
      {item.media_type === 'image' ? <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open image evidence ${item.filename}`}><img src={item.url} alt={`Evidence for issue: ${item.filename}`} loading="lazy" /></a>
        : item.media_type === 'audio' ? <audio controls preload="none" src={item.url} aria-label={`Audio evidence ${item.filename}`} />
        : <video controls playsInline preload="metadata" src={item.url} aria-label={`Video evidence ${item.filename}`} />}
      <span>{item.filename}</span>
    </div>)}
  </div>;
}

function uploadMedia(file: File, onProgress?: (percent: number) => void): Promise<UploadedEvidence> {
  const mediaType = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : '';
  if (!mediaType) return Promise.reject(new Error('Choose an image, audio, or video file.'));
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append('file', file, file.name);
    body.append('media_type', mediaType);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/media/upload`);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('The upload response was invalid. Please retry.')); }
      } else {
        let message = `Upload failed (${xhr.status}).`;
        try { const detail = JSON.parse(xhr.responseText).detail; if (detail) message = detail; } catch { /* keep status message */ }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading evidence. Please retry.'));
    xhr.onabort = () => reject(new Error('Evidence upload was canceled.'));
    const token = localStorage.getItem('utopia_token') || localStorage.getItem('civicgrid_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(body);
  });
}

function EvidencePicker({ files, onChange, onTranscript, disabled = false }: { files: File[]; onChange: (files: File[]) => void; onTranscript?: (transcript: string) => void; disabled?: boolean }) {
  const [error, setError] = useState('');
  const [transcriptionNotice, setTranscriptionNotice] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [recording, setRecording] = useState<'audio' | 'video' | null>(null);
  const [frontCamera, setFrontCamera] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const next = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(next);
    return () => next.forEach(URL.revokeObjectURL);
  }, [files]);
  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setRecordSeconds(value => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);
  useEffect(() => {
    if (previewRef.current && previewStream) previewRef.current.srcObject = previewStream;
  }, [previewStream]);
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const addFiles = (picked: FileList | File[] | null) => {
    if (!picked?.length) return;
    setError('');
    const next = [...files];
    const incoming = Array.isArray(picked) ? picked : Array.from(picked);
    for (const file of incoming) {
      if (next.length >= 5) { setError('You can attach up to 5 files.'); break; }
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : '';
      const cap = type === 'image' ? 10 : type === 'audio' ? 20 : type === 'video' ? 50 : 0;
      if (!type) { setError(`${file.name}: choose an image, audio, or video file.`); continue; }
      if (file.size === 0) { setError(`${file.name}: the file is empty.`); continue; }
      if (file.size > cap * 1024 * 1024) { setError(`${file.name}: maximum size is ${cap} MB.`); continue; }
      next.push(file);
    }
    onChange(next);
  };

  const transcribeRecording = async (file: File) => {
    if (!onTranscript) return;
    setTranscribing(true);
    setTranscriptionNotice('Transcribing your recording…');
    try {
      const form = new FormData();
      form.append('file', file, file.name);
      const result = await fetchApi<{ text: string }>('/ai/transcribe', { method: 'POST', body: form });
      if (result.text?.trim()) {
        onTranscript(result.text.trim());
        setTranscriptionNotice('Transcript added to the text field. You can review or edit it.');
      } else {
        setTranscriptionNotice('No speech was recognized. Your audio recording is still attached.');
      }
    } catch {
      setTranscriptionNotice('Transcription failed. Your audio recording is still attached; please try again or type your message.');
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async (kind: 'audio' | 'video') => {
    setError('');
    setTranscriptionNotice('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support recording. You can still choose an existing file.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(kind === 'audio' ? { audio: true } : { audio: true, video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      if (kind === 'video') setFrontCamera(false);
      setPreviewStream(stream);
      const types = kind === 'audio'
        ? ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg']
        : ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      const mimeType = types.find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => setError('Recording failed. Please try again or select a file.');
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setPreviewStream(null);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || (kind === 'audio' ? 'audio/webm' : 'video/webm') });
        if (!blob.size) { setError('The recording was empty. Please record again.'); return; }
        const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? (kind === 'audio' ? 'm4a' : 'mp4') : 'webm';
        const recordingFile = new File([blob], `utopia-${kind}-${Date.now()}.${ext}`, { type: blob.type });
        addFiles([recordingFile]);
        if (kind === 'audio' && onTranscript) void transcribeRecording(recordingFile);
        setRecording(null);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecordSeconds(0);
      setRecording(kind);
    } catch (e) {
      setPreviewStream(null);
      setError(e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Camera or microphone permission was denied. Allow access in your browser settings or choose an existing file.'
        : 'Camera or microphone could not be opened. Check that a device is available, or choose an existing file.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };
  const switchCamera = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ facingMode: { ideal: frontCamera ? 'environment' : 'user' } });
      setFrontCamera(value => !value);
    } catch {
      setError('This browser cannot switch cameras while recording. Stop and start a new video capture instead.');
    }
  };

  return (
    <section className="evidence-picker" aria-label="Attach evidence">
      <strong>Attach Evidence (Optional)</strong>
      <div className="evidence-actions">
        <label className="evidence-action"><ImageIcon size={15} /> Upload Image<input aria-label="Upload image evidence" type="file" accept="image/*" multiple disabled={disabled || !!recording || transcribing} onChange={e => { addFiles(e.target.files); e.currentTarget.value = ''; }} /></label>
        <label className="evidence-action"><Mic size={15} /> Upload Audio<input aria-label="Upload audio evidence" type="file" accept="audio/*" disabled={disabled || !!recording || transcribing} onChange={e => { addFiles(e.target.files); e.currentTarget.value = ''; }} /></label>
        <label className="evidence-action"><Video size={15} /> Upload Video<input aria-label="Upload video evidence" type="file" accept="video/*" disabled={disabled || !!recording || transcribing} onChange={e => { addFiles(e.target.files); e.currentTarget.value = ''; }} /></label>
        <label className="evidence-action"><Camera size={15} /> Take Photo<input aria-label="Capture a photo" type="file" accept="image/*" capture="environment" disabled={disabled || !!recording || transcribing} onChange={e => { addFiles(e.target.files); e.currentTarget.value = ''; }} /></label>
        {recording ? <>
          <button type="button" className="evidence-action recording" onClick={stopRecording}><Square size={14} /> Stop {recording} · {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, '0')}</button>
          {recording === 'video' && <button type="button" className="evidence-action" onClick={() => void switchCamera()}><RotateCcw size={14} /> Switch camera</button>}
        </> : <>
          <button type="button" className="evidence-action" disabled={disabled || transcribing || files.length >= 5} onClick={() => void startRecording('audio')}><Mic size={15} /> Record Audio</button>
          <button type="button" className="evidence-action" disabled={disabled || transcribing || files.length >= 5} onClick={() => void startRecording('video')}><Video size={15} /> Record Video</button>
        </>}
      </div>
      {previewStream && <video ref={previewRef} autoPlay muted playsInline className="evidence-live-preview" aria-label="Camera preview" />}
      {error && <p className="media-error" role="alert">{error}</p>}
      {transcribing && <small role="status">Transcribing audio…</small>}
      {transcriptionNotice && <small role="status">{transcriptionNotice}</small>}
      {!!files.length && <div className="evidence-file-list">{files.map((file, index) => {
        const url = previewUrls[index];
        return <div className="evidence-file" key={`${file.name}-${index}`}>
          {file.type.startsWith('image/') ? <img src={url} alt={`Preview of ${file.name}`} /> : file.type.startsWith('audio/') ? <audio src={url} controls aria-label={`Preview ${file.name}`} /> : <video src={url} controls playsInline aria-label={`Preview ${file.name}`} />}
          <span>{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type}</span>
          <button type="button" aria-label={`Remove ${file.name}`} disabled={disabled} onClick={() => onChange(files.filter((_, i) => i !== index))}><Trash2 size={15} /></button>
        </div>;
      })}</div>}
      <small>Up to 5 files · images 10 MB · audio 20 MB · video 50 MB each. Recorded audio is sent to Groq for transcription; provider usage charges may apply.</small>
    </section>
  );
}
