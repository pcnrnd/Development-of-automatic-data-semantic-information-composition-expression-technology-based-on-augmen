import { 
  LayoutDashboard, 
  Archive, 
  SlidersHorizontal, 
  Activity, 
  Gavel, 
  Network, 
  Settings, 
  HelpCircle,
  Cpu,
  Zap,
  Router,
  Search,
  Play,
  Pause,
  RotateCcw,
  Database,
  Shield,
  Filter,
  RefreshCw,
  Download,
  Terminal,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Timer,
  Share2,
  Plus
} from 'lucide-react';

export type ViewType = 'architecture' | 'archiving' | 'orchestration' | 'monitoring' | 'governance' | 'nodes';

export interface NavItem {
  id: ViewType;
  label: string;
  icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'archiving', label: 'Archiving', icon: Archive },
  { id: 'orchestration', label: 'Orchestration', icon: SlidersHorizontal },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'governance', label: 'Pipeline', icon: Gavel },
  { id: 'nodes', label: 'Node Management', icon: Network },
];

export const FOOTER_NAV = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'support', label: 'Support', icon: HelpCircle },
];
