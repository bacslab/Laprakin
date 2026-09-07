import { forwardRef } from 'react';
import * as Iconoir from 'iconoir-react';

/**
 * Compatibility surface for the app's former icon names.
 * Every exported component is backed by an Iconoir SVG and normalizes the
 * Lucide-style `size` prop used throughout the existing UI. Iconoir's
 * default stroke is intentionally a little heavier than its 1.5 baseline so
 * icons remain legible beside the app's compact typography.
 */
function makeIcon(Icon, displayName) {
  const Wrapped = forwardRef(function IconoirCompat({ size, width, height, strokeWidth = 1.8, ...props }, ref) {
    const dimension = size ?? undefined;
    return <Icon ref={ref} width={width ?? dimension} height={height ?? dimension} strokeWidth={strokeWidth} {...props} />;
  });
  Wrapped.displayName = displayName;
  return Wrapped;
}

const map = {
  Activity: Iconoir.Activity,
  AlertCircle: Iconoir.WarningCircle,
  AlertOctagon: Iconoir.WarningHexagon,
  AlertTriangle: Iconoir.WarningTriangle,
  Archive: Iconoir.Archive,
  ArrowDownToLine: Iconoir.ArrowDown,
  ArrowLeft: Iconoir.ArrowLeft,
  ArrowRight: Iconoir.ArrowRight,
  Bell: Iconoir.Bell,
  BellRing: Iconoir.BellNotification,
  Bot: Iconoir.Cpu,
  CalendarClock: Iconoir.CalendarRotate,
  Check: Iconoir.Check,
  CheckCircle2: Iconoir.CheckCircle,
  ChevronDown: Iconoir.NavArrowDown,
  ChevronRight: Iconoir.NavArrowRight,
  CircleAlert: Iconoir.WarningCircle,
  CircleUserRound: Iconoir.UserCircle,
  ClipboardList: Iconoir.TaskList,
  Clock3: Iconoir.Clock,
  CodeXml: Iconoir.CodeBrackets,
  Copy: Iconoir.Copy,
  CreditCard: Iconoir.CreditCard,
  Database: Iconoir.Database,
  Eye: Iconoir.Eye,
  EyeOff: Iconoir.EyeClosed,
  FileCog: Iconoir.PageEdit,
  FileImage: Iconoir.MediaImage,
  FileSpreadsheet: Iconoir.Table,
  FileText: Iconoir.Page,
  FlaskConical: Iconoir.Flask,
  FolderKanban: Iconoir.KanbanBoard,
  FolderOpen: Iconoir.Folder,
  Gauge: Iconoir.DashboardSpeed,
  GitBranchPlus: Iconoir.GitBranch,
  Globe2: Iconoir.Globe,
  GraduationCap: Iconoir.GraduationCap,
  GripVertical: Iconoir.Drag,
  HelpCircle: Iconoir.HelpCircle,
  History: Iconoir.ClockRotateRight,
  ImagePlus: Iconoir.MediaImagePlus,
  KeyRound: Iconoir.Key,
  Keyboard: Iconoir.KeyCommand,
  Languages: Iconoir.Language,
  LayoutDashboard: Iconoir.Dashboard,
  LayoutTemplate: Iconoir.LayoutLeft,
  Link2: Iconoir.Link,
  LoaderCircle: Iconoir.RefreshDouble,
  LockKeyhole: Iconoir.Lock,
  LogOut: Iconoir.LogOut,
  Mail: Iconoir.Mail,
  Megaphone: Iconoir.Megaphone,
  Menu: Iconoir.Menu,
  MessageCircle: Iconoir.ChatBubble,
  MessageSquareText: Iconoir.MessageText,
  Monitor: Iconoir.Computer,
  Moon: Iconoir.HalfMoon,
  MoreHorizontal: Iconoir.MoreHoriz,
  Network: Iconoir.Network,
  Palette: Iconoir.Palette,
  PanelLeftClose: Iconoir.SidebarCollapse,
  PanelLeftOpen: Iconoir.SidebarExpand,
  PanelRightClose: Iconoir.SidebarCollapse,
  PanelRightOpen: Iconoir.SidebarExpand,
  Paperclip: Iconoir.Attachment,
  Pencil: Iconoir.EditPencil,
  Pin: Iconoir.Pin,
  PinOff: Iconoir.PinSlash,
  Play: Iconoir.Play,
  Plus: Iconoir.Plus,
  Power: Iconoir.SwitchOn,
  RefreshCw: Iconoir.RefreshDouble,
  RotateCcw: Iconoir.UndoAction,
  Save: Iconoir.FloppyDisk,
  Search: Iconoir.Search,
  Send: Iconoir.Send,
  ServerCog: Iconoir.ServerConnection,
  Settings2: Iconoir.Settings,
  Share2: Iconoir.ShareAndroid,
  Shield: Iconoir.Shield,
  ShieldAlert: Iconoir.ShieldAlert,
  ShieldCheck: Iconoir.ShieldCheck,
  Sliders: Iconoir.ControlSlider,
  SlidersHorizontal: Iconoir.ControlSlider,
  Sparkles: Iconoir.Sparks,
  Sun: Iconoir.SunLight,
  ThumbsDown: Iconoir.ThumbsDown,
  ThumbsUp: Iconoir.ThumbsUp,
  Trash2: Iconoir.Trash,
  Upload: Iconoir.Upload,
  UploadCloud: Iconoir.CloudUpload,
  UserRound: Iconoir.User,
  Users: Iconoir.Community,
  X: Iconoir.Xmark,
};

export const LoaderCircle = makeIcon(map.LoaderCircle, 'LoaderCircle');

export const Activity = makeIcon(map.Activity, 'Activity');
export const AlertCircle = makeIcon(map.AlertCircle, 'AlertCircle');
export const AlertOctagon = makeIcon(map.AlertOctagon, 'AlertOctagon');
export const AlertTriangle = makeIcon(map.AlertTriangle, 'AlertTriangle');
export const Archive = makeIcon(map.Archive, 'Archive');
export const ArrowDownToLine = makeIcon(map.ArrowDownToLine, 'ArrowDownToLine');
export const ArrowLeft = makeIcon(map.ArrowLeft, 'ArrowLeft');
export const ArrowRight = makeIcon(map.ArrowRight, 'ArrowRight');
export const Bell = makeIcon(map.Bell, 'Bell');
export const BellRing = makeIcon(map.BellRing, 'BellRing');
export const Bot = makeIcon(map.Bot, 'Bot');
export const CalendarClock = makeIcon(map.CalendarClock, 'CalendarClock');
export const Check = makeIcon(map.Check, 'Check');
export const CheckCircle2 = makeIcon(map.CheckCircle2, 'CheckCircle2');
export const ChevronDown = makeIcon(map.ChevronDown, 'ChevronDown');
export const ChevronRight = makeIcon(map.ChevronRight, 'ChevronRight');
export const CircleAlert = makeIcon(map.CircleAlert, 'CircleAlert');
export const CircleUserRound = makeIcon(map.CircleUserRound, 'CircleUserRound');
export const ClipboardList = makeIcon(map.ClipboardList, 'ClipboardList');
export const Clock3 = makeIcon(map.Clock3, 'Clock3');
export const CodeXml = makeIcon(map.CodeXml, 'CodeXml');
export const Copy = makeIcon(map.Copy, 'Copy');
export const CreditCard = makeIcon(map.CreditCard, 'CreditCard');
export const Database = makeIcon(map.Database, 'Database');
export const Eye = makeIcon(map.Eye, 'Eye');
export const EyeOff = makeIcon(map.EyeOff, 'EyeOff');
export const FileCog = makeIcon(map.FileCog, 'FileCog');
export const FileImage = makeIcon(map.FileImage, 'FileImage');
export const FileSpreadsheet = makeIcon(map.FileSpreadsheet, 'FileSpreadsheet');
export const FileText = makeIcon(map.FileText, 'FileText');
export const FlaskConical = makeIcon(map.FlaskConical, 'FlaskConical');
export const FolderKanban = makeIcon(map.FolderKanban, 'FolderKanban');
export const FolderOpen = makeIcon(map.FolderOpen, 'FolderOpen');
export const Gauge = makeIcon(map.Gauge, 'Gauge');
export const GitBranchPlus = makeIcon(map.GitBranchPlus, 'GitBranchPlus');
export const Globe2 = makeIcon(map.Globe2, 'Globe2');
export const GraduationCap = makeIcon(map.GraduationCap, 'GraduationCap');
export const GripVertical = makeIcon(map.GripVertical, 'GripVertical');
export const HelpCircle = makeIcon(map.HelpCircle, 'HelpCircle');
export const History = makeIcon(map.History, 'History');
export const ImagePlus = makeIcon(map.ImagePlus, 'ImagePlus');
export const KeyRound = makeIcon(map.KeyRound, 'KeyRound');
export const Keyboard = makeIcon(map.Keyboard, 'Keyboard');
export const Languages = makeIcon(map.Languages, 'Languages');
export const LayoutDashboard = makeIcon(map.LayoutDashboard, 'LayoutDashboard');
export const LayoutTemplate = makeIcon(map.LayoutTemplate, 'LayoutTemplate');
export const Link2 = makeIcon(map.Link2, 'Link2');
export const LockKeyhole = makeIcon(map.LockKeyhole, 'LockKeyhole');
export const LogOut = makeIcon(map.LogOut, 'LogOut');
export const Mail = makeIcon(map.Mail, 'Mail');
export const Megaphone = makeIcon(map.Megaphone, 'Megaphone');
export const Menu = makeIcon(map.Menu, 'Menu');
export const MessageCircle = makeIcon(map.MessageCircle, 'MessageCircle');
export const MessageSquareText = makeIcon(map.MessageSquareText, 'MessageSquareText');
export const Monitor = makeIcon(map.Monitor, 'Monitor');
export const Moon = makeIcon(map.Moon, 'Moon');
export const MoreHorizontal = makeIcon(map.MoreHorizontal, 'MoreHorizontal');
export const Network = makeIcon(map.Network, 'Network');
export const Palette = makeIcon(map.Palette, 'Palette');
export const PanelLeftClose = makeIcon(map.PanelLeftClose, 'PanelLeftClose');
export const PanelLeftOpen = makeIcon(map.PanelLeftOpen, 'PanelLeftOpen');
export const PanelRightClose = makeIcon(map.PanelRightClose, 'PanelRightClose');
export const PanelRightOpen = makeIcon(map.PanelRightOpen, 'PanelRightOpen');
export const Paperclip = makeIcon(map.Paperclip, 'Paperclip');
export const Pencil = makeIcon(map.Pencil, 'Pencil');
export const Pin = makeIcon(map.Pin, 'Pin');
export const PinOff = makeIcon(map.PinOff, 'PinOff');
export const Play = makeIcon(map.Play, 'Play');
export const Plus = makeIcon(map.Plus, 'Plus');
export const Power = makeIcon(map.Power, 'Power');
export const RefreshCw = makeIcon(map.RefreshCw, 'RefreshCw');
export const RotateCcw = makeIcon(map.RotateCcw, 'RotateCcw');
export const Save = makeIcon(map.Save, 'Save');
export const Search = makeIcon(map.Search, 'Search');
export const Send = makeIcon(map.Send, 'Send');
export const ServerCog = makeIcon(map.ServerCog, 'ServerCog');
export const Settings2 = makeIcon(map.Settings2, 'Settings2');
export const Share2 = makeIcon(map.Share2, 'Share2');
export const Shield = makeIcon(map.Shield, 'Shield');
export const ShieldAlert = makeIcon(map.ShieldAlert, 'ShieldAlert');
export const ShieldCheck = makeIcon(map.ShieldCheck, 'ShieldCheck');
export const Sliders = makeIcon(map.Sliders, 'Sliders');
export const SlidersHorizontal = makeIcon(map.SlidersHorizontal, 'SlidersHorizontal');
export const Sparkles = makeIcon(map.Sparkles, 'Sparkles');
export const Sun = makeIcon(map.Sun, 'Sun');
export const ThumbsDown = makeIcon(map.ThumbsDown, 'ThumbsDown');
export const ThumbsUp = makeIcon(map.ThumbsUp, 'ThumbsUp');
export const Trash2 = makeIcon(map.Trash2, 'Trash2');
export const Upload = makeIcon(map.Upload, 'Upload');
export const UploadCloud = makeIcon(map.UploadCloud, 'UploadCloud');
export const UserRound = makeIcon(map.UserRound, 'UserRound');
export const Users = makeIcon(map.Users, 'Users');
export const X = makeIcon(map.X, 'X');
