"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ModeToggle } from "@/components/mode-toggle";

type Dataset = {
  id: string;
  name: string;
  rowCount: number;
  fileType: string;
  columns: string[];
  createdAt: string;
};

type Profile = {
  id: string;
  name: string;
  upstreamUrl: string;
  method: string;
  requestTemplate: string;
  headers: Record<string, string>;
  inputBindings: Array<{ placeholder: string; column: string }>;
  extractRules: Array<{ key: string; path: string; mode?: "text" | "json" }>;
  streamProtocol: "auto" | "sse" | "ndjson" | "plain_text";
  doneStrategy: "auto" | "manual";
  doneRules: unknown[];
  doneRequired: boolean;
};

type Task = {
  id: string;
  datasetId: string;
  profileId: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  dataset: { name: string };
  profile: { name: string };
};

type ResultRow = {
  id: string;
  rowIndex: number;
  status: string;
  ttftMs: number | null;
  latencyMs: number | null;
  errorType: string | null;
  errorMessage: string | null;
  endReason: string | null;
  ruleHit: string | null;
  outputs: Record<string, unknown>;
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.message || "请求失败");
  return json.data as T;
}

function getReplyPreview(outputs: Record<string, unknown>) {
  const prefer = ["text", "reply", "content", "thinking"];
  for (const key of prefer) {
    const value = outputs[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  for (const value of Object.values(outputs)) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "-";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState("datasets");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");

  const [isCurlDialogOpen, setIsCurlDialogOpen] = useState(false);
  const [curlInput, setCurlInput] = useState("");

  const [editingProfileId, setEditingProfileId] = useState("");
  const [profileName, setProfileName] = useState("默认配置");
  const [upstreamUrl, setUpstreamUrl] = useState("https://dingstest.133.cn/aichate");
  const [requestTemplate, setRequestTemplate] = useState(JSON.stringify({ msg: "{{msg}}", sessionId: "{{sessionId}}", stream: "true", channel: "Rokid" }, null, 2));
  const [headerConfig, setHeaderConfig] = useState('{"Content-Type":"application/json"}');
  const [inputBindings, setInputBindings] = useState('[{"placeholder":"msg","column":"msg"},{"placeholder":"sessionId","column":"sessionId"}]');
  const [extractRules, setExtractRules] = useState('[{"key":"text","path":"$.text"},{"key":"thinking","path":"$.thinkcontent"}]');
  const [doneRules, setDoneRules] = useState('[{"type":"sentinel_text","value":"[DONE]"},{"type":"json_path_equals","path":"$.type","equals":2}]');
  const [streamProtocol, setStreamProtocol] = useState<"auto" | "sse" | "ndjson" | "plain_text">("auto");
  const [doneStrategy, setDoneStrategy] = useState<"auto" | "manual">("auto");
  const [doneRequired, setDoneRequired] = useState(false);

  const [dryRunProfileId, setDryRunProfileId] = useState("");
  const [dryRunDatasetId, setDryRunDatasetId] = useState("");
  const [dryRunResponse, setDryRunResponse] = useState<Record<string, unknown> | null>(null);
  const [isDryRunning, setIsDryRunning] = useState(false);

  const [taskDatasetId, setTaskDatasetId] = useState("");
  const [taskProfileId, setTaskProfileId] = useState("");
  const [taskConcurrency, setTaskConcurrency] = useState("20");
  const [taskTimeoutMs, setTaskTimeoutMs] = useState("60000");
  const [taskRetry, setTaskRetry] = useState("2");

  const [previewTaskId, setPreviewTaskId] = useState("");
  const [liveRows, setLiveRows] = useState<ResultRow[]>([]);

  const [resultTaskId, setResultTaskId] = useState("");
  const [resultRows, setResultRows] = useState<ResultRow[]>([]);
  const [resultTotal, setResultTotal] = useState(0);
  const [avgTtftMs, setAvgTtftMs] = useState<number | null>(null);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([]);
  const [resultPage, setResultPage] = useState(1);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailText, setDetailText] = useState("");

  const selectedTask = useMemo(() => tasks.find((t) => t.id === resultTaskId), [tasks, resultTaskId]);
  const selectedDataset = useMemo(
    () => datasets.find((d) => d.id === selectedTask?.datasetId),
    [datasets, selectedTask],
  );
  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedTask?.profileId),
    [profiles, selectedTask],
  );

  const availableExportColumns = useMemo(() => {
    const resultColumns = [
      "result:rowIndex",
      "result:status",
      "result:ttftMs",
      "result:latencyMs",
      "result:errorType",
      "result:errorMessage",
      "result:endReason",
      "result:ruleHit",
    ];
    const inputColumns = (selectedDataset?.columns ?? []).map((col) => `input:${col}`);
    const outputColumns = (selectedProfile?.extractRules ?? []).map((rule) => `output:${rule.key}`);
    return [...inputColumns, ...resultColumns, ...outputColumns];
  }, [selectedDataset, selectedProfile]);

  const resetProfileForm = useCallback(() => {
    setEditingProfileId("");
    setProfileName("默认配置");
    setUpstreamUrl("https://dingstest.133.cn/aichate");
    setRequestTemplate(JSON.stringify({ msg: "{{msg}}", sessionId: "{{sessionId}}", stream: "true", channel: "Rokid" }, null, 2));
    setHeaderConfig('{"Content-Type":"application/json"}');
    setInputBindings('[{"placeholder":"msg","column":"msg"},{"placeholder":"sessionId","column":"sessionId"}]');
    setExtractRules('[{"key":"text","path":"$.text"},{"key":"thinking","path":"$.thinkcontent"}]');
    setDoneRules('[{"type":"sentinel_text","value":"[DONE]"},{"type":"json_path_equals","path":"$.type","equals":2}]');
    setStreamProtocol("auto");
    setDoneStrategy("auto");
    setDoneRequired(false);
  }, []);

  const loadBase = useCallback(async () => {
    const [ds, ps, ts] = await Promise.all([
      api<Dataset[]>("/api/datasets"),
      api<Profile[]>("/api/profiles"),
      api<Task[]>("/api/tasks"),
    ]);
    setDatasets(ds);
    setProfiles(ps);
    setTasks(ts);

    if ((!taskDatasetId || !ds.some((d) => d.id === taskDatasetId)) && ds[0]) setTaskDatasetId(ds[0].id);
    if ((!dryRunDatasetId || !ds.some((d) => d.id === dryRunDatasetId)) && ds[0]) setDryRunDatasetId(ds[0].id);
    if ((!dryRunProfileId || !ps.some((p) => p.id === dryRunProfileId)) && ps[0]) setDryRunProfileId(ps[0].id);
    if ((!taskProfileId || !ps.some((p) => p.id === taskProfileId)) && ps[0]) setTaskProfileId(ps[0].id);
    if ((!resultTaskId || !ts.some((t) => t.id === resultTaskId)) && ts[0]) {
      setResultTaskId(ts[0].id);
      setSelectedExportColumns([]);
    }

    if (!previewTaskId || !ts.some((t) => t.id === previewTaskId)) {
      const running = ts.find((t) => t.status === "running" || t.status === "queued");
      if (running) setPreviewTaskId(running.id);
      else if (ts[0]) setPreviewTaskId(ts[0].id);
    }

    if (editingProfileId && !ps.some((p) => p.id === editingProfileId)) {
      resetProfileForm();
    }
  }, [dryRunDatasetId, dryRunProfileId, editingProfileId, previewTaskId, resetProfileForm, resultTaskId, taskDatasetId, taskProfileId]);

  const loadResults = useCallback(async () => {
    if (!resultTaskId) return;
    const data = await api<{ total: number; page: number; rows: ResultRow[]; avgTtftMs: number | null }>(
      `/api/tasks/${resultTaskId}/results?page=${resultPage}&pageSize=20`,
    );
    setResultRows(data.rows);
    setResultTotal(data.total);
    setAvgTtftMs(data.avgTtftMs);
  }, [resultPage, resultTaskId]);

  const loadLivePreview = useCallback(async () => {
    if (!previewTaskId) return;
    const data = await api<{ rows: ResultRow[] }>(`/api/tasks/${previewTaskId}/results?page=1&pageSize=10&order=desc`);
    setLiveRows(data.rows);
  }, [previewTaskId]);

  useEffect(() => {
    queueMicrotask(() => {
      loadBase().catch((e) => toast.error(e.message));
    });
  }, [loadBase]);

  useEffect(() => {
    queueMicrotask(() => {
      loadResults().catch((e) => toast.error(e.message));
    });
  }, [loadResults]);

  useEffect(() => {
    if (!selectedTask || selectedExportColumns.length > 0) return;
    const defaults = [
      ...(selectedDataset?.columns ?? []).map((col) => `input:${col}`),
      "result:status",
      "result:ttftMs",
      "result:latencyMs",
      ...((selectedProfile?.extractRules ?? []).map((rule) => `output:${rule.key}`)),
    ];
    queueMicrotask(() => {
      setSelectedExportColumns(defaults.length > 0 ? defaults : ["result:rowIndex", "result:status"]);
    });
  }, [selectedDataset, selectedExportColumns.length, selectedProfile, selectedTask]);

  useEffect(() => {
    if (!previewTaskId) return;
    queueMicrotask(() => {
      loadLivePreview().catch((e) => toast.error(e.message));
    });
    const timer = setInterval(() => {
      loadLivePreview().catch((e) => toast.error(e.message));
    }, 2000);
    return () => clearInterval(timer);
  }, [loadLivePreview, previewTaskId]);

  useEffect(() => {
    if (activeTab !== "tasks") return;
    const timer = setInterval(() => {
      loadBase().catch((e) => toast.error(e.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [activeTab, loadBase]);

  async function uploadDataset() {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.set("file", uploadFile);
    formData.set("name", uploadName);
    await api("/api/datasets/upload", { method: "POST", body: formData });
    toast.success("数据集上传成功");
    setUploadFile(null);
    setUploadName("");
    await loadBase();
  }

  async function deleteDataset(datasetId: string) {
    await api(`/api/datasets/${datasetId}`, { method: "DELETE" });
    toast.success("数据集已删除");
    await loadBase();
  }

  async function saveProfile() {
    let parsedHeaders: Record<string, string>;
    let parsedBindings: Array<{ placeholder: string; column: string }>;
    let parsedExtractRules: Array<{ key: string; path: string; mode?: "text" | "json" }>;
    let parsedDoneRules: unknown[];

    try {
      parsedHeaders = JSON.parse(headerConfig);
      parsedBindings = JSON.parse(inputBindings);
      parsedExtractRules = JSON.parse(extractRules);
      parsedDoneRules = JSON.parse(doneRules);
    } catch {
      toast.error("配置 JSON 格式错误，请检查 Header/Bindings/Rules");
      return;
    }

    const payload = {
      name: profileName,
      upstreamUrl,
      method: "POST",
      requestTemplate,
      headers: parsedHeaders,
      inputBindings: parsedBindings,
      extractRules: parsedExtractRules,
      streamProtocol,
      doneStrategy,
      doneRules: parsedDoneRules,
      doneRequired,
    };

    if (editingProfileId) {
      await api(`/api/profiles/${editingProfileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("配置已更新");
    } else {
      await api("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("配置已保存");
    }

    resetProfileForm();
    await loadBase();
  }

  function editProfile(profile: Profile) {
    setEditingProfileId(profile.id);
    setProfileName(profile.name);
    setUpstreamUrl(profile.upstreamUrl);
    setRequestTemplate(profile.requestTemplate);
    setHeaderConfig(JSON.stringify(profile.headers ?? {}, null, 2));
    setInputBindings(JSON.stringify(profile.inputBindings ?? [], null, 2));
    setExtractRules(JSON.stringify(profile.extractRules ?? [], null, 2));
    setDoneRules(JSON.stringify(profile.doneRules ?? [], null, 2));
    setStreamProtocol(profile.streamProtocol);
    setDoneStrategy(profile.doneStrategy);
    setDoneRequired(profile.doneRequired);
    setActiveTab("profiles");
  }

  async function deleteProfile(profileId: string) {
    await api(`/api/profiles/${profileId}`, { method: "DELETE" });
    toast.success("配置已删除");
    if (editingProfileId === profileId) resetProfileForm();
    await loadBase();
  }

  async function duplicateProfile(profileId: string) {
    const duplicated = await api<Profile>(`/api/profiles/${profileId}/duplicate`, { method: "POST" });
    const duplicatedProfile = await api<Profile>(`/api/profiles/${duplicated.id}`);
    editProfile(duplicatedProfile);
    toast.success(`已创建副本：${duplicated.name}`);
    await loadBase();
  }

  function handleImportCurl() {
    if (!curlInput.trim()) {
      toast.error("请输入 curl 命令");
      return;
    }

    const cleanCommand = curlInput.replace(/\\\r?\n/g, ' ');
    let url = "";
    let method = "GET";
    const headers: Record<string, string> = {};
    let body = "";

    const unquote = (str: string) => {
      str = str.trim();
      if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
        return str.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
      }
      return str;
    };

    const args: string[] = [];
    let currentWord = "";
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escapeNext = false;

    for (let i = 0; i < cleanCommand.length; i++) {
      const char = cleanCommand[i];
      if (escapeNext) {
        currentWord += char;
        escapeNext = false;
        continue;
      }
      if (char === '\\' && !inSingleQuote) {
        escapeNext = true;
        continue;
      }
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        currentWord += char;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        currentWord += char;
        continue;
      }
      if (/\s/.test(char) && !inSingleQuote && !inDoubleQuote) {
        if (currentWord.length > 0) {
          args.push(currentWord);
          currentWord = "";
        }
      } else {
        currentWord += char;
      }
    }
    if (currentWord.length > 0) args.push(currentWord);

    for (let i = 0; i < args.length; i++) {
        const arg = unquote(args[i]);
        if (arg === "curl") continue;
        
        const peek = args[i];
        if (peek === "-X" || peek === "--request") {
            method = unquote(args[++i]).toUpperCase();
        } else if (peek === "-H" || peek === "--header") {
            const headerLine = unquote(args[++i]);
            const splitIdx = headerLine.indexOf(':');
            if (splitIdx > -1) {
                headers[headerLine.slice(0, splitIdx).trim()] = headerLine.slice(splitIdx + 1).trim();
            }
        } else if (peek === "-d" || peek === "--data" || peek === "--data-raw" || peek === "--data-binary" || peek === "--data-urlencode") {
            body = unquote(args[++i] || "");
            if (method === "GET") method = "POST";
        } else if (arg.startsWith("http://") || arg.startsWith("https://")) {
            url = arg;
        }
    }

    if (url) setUpstreamUrl(url);
    if (Object.keys(headers).length > 0) {
        setHeaderConfig(JSON.stringify(headers, null, 2));
    }
    if (body) {
        try {
            setRequestTemplate(JSON.stringify(JSON.parse(body), null, 2));
        } catch {
            setRequestTemplate(body);
        }
    }

    setIsCurlDialogOpen(false);
    setCurlInput("");
    toast.success("Curl 解析成功，配置已填充");
  }

  async function dryRun() {
    if (!dryRunProfileId || !dryRunDatasetId || isDryRunning) return;
    setIsDryRunning(true);
    try {
      const data = await api<Record<string, unknown>>(`/api/profiles/${dryRunProfileId}/dry-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetId: dryRunDatasetId }),
      });
      setDryRunResponse(data);
      toast.success("Dry Run 完成");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Dry Run 失败");
    } finally {
      setIsDryRunning(false);
    }
  }

  async function createTask() {
    await api("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datasetId: taskDatasetId,
        profileId: taskProfileId,
        concurrency: Number(taskConcurrency),
        timeoutMs: Number(taskTimeoutMs),
        retryCount: Number(taskRetry),
      }),
    });
    toast.success("任务已创建");
    await loadBase();
  }

  async function controlTask(taskId: string, action: "pause" | "resume" | "stop") {
    await api(`/api/tasks/${taskId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    toast.success(`任务已${action}`);
    await loadBase();
  }

  async function deleteTask(taskId: string) {
    await api(`/api/tasks/${taskId}`, { method: "DELETE" });
    toast.success("任务已删除");
    if (resultTaskId === taskId) setResultTaskId("");
    if (previewTaskId === taskId) {
      setPreviewTaskId("");
      setLiveRows([]);
    }
    await loadBase();
  }

  function jumpToTaskResults(taskId: string) {
    setResultTaskId(taskId);
    setSelectedExportColumns([]);
    setResultPage(1);
    setActiveTab("results");
  }

  async function exportTask(format: "xlsx" | "csv") {
    if (!resultTaskId) return;
    const columns = encodeURIComponent(JSON.stringify(selectedExportColumns));
    window.open(`/api/tasks/${resultTaskId}/export?format=${format}&columns=${columns}`, "_blank");
  }

  function addExportColumn(column: string) {
    setSelectedExportColumns((prev) => (prev.includes(column) ? prev : [...prev, column]));
  }

  function removeExportColumn(column: string) {
    setSelectedExportColumns((prev) => prev.filter((item) => item !== column));
  }

  function moveExportColumn(index: number, direction: -1 | 1) {
    setSelectedExportColumns((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function getColumnLabel(column: string) {
    if (column.startsWith("input:")) return `原始数据 / ${column.replace("input:", "")}`;
    if (column.startsWith("output:")) return `提取结果 / ${column.replace("output:", "")}`;
    if (column.startsWith("result:")) return `任务结果 / ${column.replace("result:", "")}`;
    return column;
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const maxPage = Math.max(1, Math.ceil(resultTotal / 20));
  const progress = selectedTask
    ? Math.min(100, Math.round(((selectedTask.successRows + selectedTask.failedRows) / Math.max(selectedTask.totalRows, 1)) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Eval-Any-Agent Logo" width={44} height={44} className="rounded-md" priority unoptimized />
            <h1 className="text-2xl font-semibold">Eval-Any-Agent 控制台</h1>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Button variant="outline" onClick={logout}>退出登录</Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="datasets">数据集</TabsTrigger>
            <TabsTrigger value="profiles">配置中心</TabsTrigger>
            <TabsTrigger value="dryrun">Dry Run</TabsTrigger>
            <TabsTrigger value="tasks">任务执行</TabsTrigger>
            <TabsTrigger value="results">结果与导出</TabsTrigger>
          </TabsList>

          <TabsContent value="datasets">
            <Card>
              <CardHeader>
                <CardTitle>上传数据集</CardTitle>
                <CardDescription>支持 CSV/XLSX</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Input placeholder="数据集名称（可选）" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                  <Button onClick={uploadDataset} disabled={!uploadFile}>上传</Button>
                </div>
                <Separator />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>行数</TableHead>
                      <TableHead>字段</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {datasets.map((ds) => (
                      <TableRow key={ds.id}>
                        <TableCell>{ds.name}</TableCell>
                        <TableCell><Badge variant="outline">{ds.fileType}</Badge></TableCell>
                        <TableCell>{ds.rowCount}</TableCell>
                        <TableCell className="max-w-[420px] truncate">{(ds.columns || []).join(", ")}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">删除</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除数据集？</AlertDialogTitle>
                                <AlertDialogDescription>删除后关联任务也会被清理。</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteDataset(ds.id)}>确认删除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profiles">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>映射配置中心</CardTitle>
                    <CardDescription>请求模板、Header、字段绑定、提取规则、结束信号规则</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsCurlDialogOpen(true)}>解析 Curl</Button>
                    <Button asChild variant="outline" size="icon" aria-label="配置帮助">
                      <Link href="/help/config-center" target="_blank" rel="noopener noreferrer">?</Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="配置名称" />
                  <Input value={upstreamUrl} onChange={(e) => setUpstreamUrl(e.target.value)} placeholder="上游 API URL" />
                </div>

                <Accordion type="multiple" defaultValue={["template", "extract", "done"]}>
                  <AccordionItem value="template">
                    <AccordionTrigger>请求模板、Header 与绑定</AccordionTrigger>
                    <AccordionContent className="space-y-3 overflow-visible">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">请求体模板（JSON）</div>
                        <Textarea
                          className="focus-visible:ring-0 focus-visible:border-ring"
                          value={requestTemplate}
                          onChange={(e) => setRequestTemplate(e.target.value)}
                          rows={8}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Header 配置（JSON）</div>
                        <Textarea
                          className="focus-visible:ring-0 focus-visible:border-ring"
                          value={headerConfig}
                          onChange={(e) => setHeaderConfig(e.target.value)}
                          rows={5}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">输入绑定 input_bindings（JSON）</div>
                        <Textarea
                          className="focus-visible:ring-0 focus-visible:border-ring"
                          value={inputBindings}
                          onChange={(e) => setInputBindings(e.target.value)}
                          rows={4}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="extract">
                    <AccordionTrigger>提取规则 extract_rules</AccordionTrigger>
                    <AccordionContent className="overflow-visible">
                      <Textarea
                        className="focus-visible:ring-0 focus-visible:border-ring"
                        value={extractRules}
                        onChange={(e) => setExtractRules(e.target.value)}
                        rows={6}
                      />
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="done">
                    <AccordionTrigger>结束信号规则 done_rules</AccordionTrigger>
                    <AccordionContent className="space-y-3 overflow-visible">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Select value={streamProtocol} onValueChange={(v) => setStreamProtocol(v as typeof streamProtocol)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">auto</SelectItem>
                            <SelectItem value="sse">sse</SelectItem>
                            <SelectItem value="ndjson">ndjson</SelectItem>
                            <SelectItem value="plain_text">plain_text</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={doneStrategy} onValueChange={(v) => setDoneStrategy(v as typeof doneStrategy)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">auto</SelectItem>
                            <SelectItem value="manual">manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea
                        className="focus-visible:ring-0 focus-visible:border-ring"
                        value={doneRules}
                        onChange={(e) => setDoneRules(e.target.value)}
                        rows={6}
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox checked={doneRequired} onCheckedChange={(v) => setDoneRequired(Boolean(v))} id="done-required" />
                        <label htmlFor="done-required" className="text-sm">done_required（未命中规则时标记 END_SIGNAL_MISSING）</label>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <Dialog open={isCurlDialogOpen} onOpenChange={setIsCurlDialogOpen}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>从 Curl 导入配置</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 overflow-hidden w-full">
                      <Textarea 
                        placeholder="在此粘贴 curl 命令..." 
                        className="h-64 w-full font-mono text-xs focus-visible:ring-0 focus-visible:border-ring resize-none break-all" 
                        value={curlInput} 
                        onChange={(e) => setCurlInput(e.target.value)} 
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsCurlDialogOpen(false)}>取消</Button>
                        <Button onClick={handleImportCurl}>解析并填充</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={saveProfile}>{editingProfileId ? "更新配置" : "保存配置"}</Button>
                    </TooltipTrigger>
                    <TooltipContent>配置保存后可用于 Dry Run 与批量任务</TooltipContent>
                  </Tooltip>
                  {editingProfileId ? (
                    <Button variant="outline" onClick={resetProfileForm}>取消编辑</Button>
                  ) : null}
                </div>

                <Separator />
                <div className="space-y-2">
                  <div className="text-sm font-medium">已保存配置</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>策略</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {profiles.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>{profile.name}</TableCell>
                          <TableCell className="max-w-[360px] truncate">{profile.upstreamUrl}</TableCell>
                          <TableCell>{profile.doneStrategy} / {profile.streamProtocol}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" onClick={() => editProfile(profile)}>修改</Button>
                              <Button size="sm" variant="outline" onClick={() => duplicateProfile(profile.id)}>创建副本</Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">删除</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>确认删除配置？</AlertDialogTitle>
                                    <AlertDialogDescription>删除后无法恢复，相关任务仍可保留历史结果。</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteProfile(profile.id)}>确认删除</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dryrun">
            <Card>
              <CardHeader>
                <CardTitle>单点试跑 Dry Run</CardTitle>
                <CardDescription>选择“数据集 + 配置”组合后试跑</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Select value={dryRunDatasetId} onValueChange={setDryRunDatasetId}>
                    <SelectTrigger><SelectValue placeholder="选择数据集" /></SelectTrigger>
                    <SelectContent>
                      {datasets.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={dryRunProfileId} onValueChange={setDryRunProfileId}>
                    <SelectTrigger><SelectValue placeholder="选择配置" /></SelectTrigger>
                    <SelectContent>
                      {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={dryRun} disabled={isDryRunning}>
                    {isDryRunning ? "正在请求..." : "发送测试"}
                  </Button>
                </div>

                {dryRunResponse ? (
                  <Alert>
                    <AlertTitle>Dry Run 结果摘要</AlertTitle>
                    <AlertDescription className="mt-2 space-y-1">
                      <div><span className="font-semibold">TTFT:</span> {dryRunResponse.ttftMs != null ? String(dryRunResponse.ttftMs) : "-"} ms | <span className="font-semibold">耗时:</span> {dryRunResponse.latencyMs != null ? String(dryRunResponse.latencyMs) : "-"} ms</div>
                      <div><span className="font-semibold">结束原因:</span> {String(dryRunResponse.endReason)} {dryRunResponse.ruleHit ? `(命中: ${String(dryRunResponse.ruleHit)})` : ""}</div>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {dryRunResponse && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                       <div className="text-sm font-medium">请求 Payload (发送给上游)</div>
                       <ScrollArea className="h-64 w-full rounded border p-3 bg-muted/50">
                          <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(dryRunResponse.requestPayload, null, 2)}</pre>
                       </ScrollArea>
                    </div>
                    <div className="space-y-2">
                       <div className="text-sm font-medium">提取结果 (Outputs)</div>
                       <ScrollArea className="h-64 w-full rounded border p-3 bg-muted/50">
                          <pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(dryRunResponse.outputs, null, 2)}</pre>
                       </ScrollArea>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-sm font-medium">完整结果详情</div>
                  <ScrollArea className="h-80 w-full rounded border p-3 bg-card">
                    <pre className="text-xs whitespace-pre-wrap break-all">{dryRunResponse ? JSON.stringify(dryRunResponse, null, 2) : "暂无结果"}</pre>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>并发任务执行</CardTitle>
                <CardDescription>动态组合数据集与配置，创建并管理任务</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">数据集</div>
                    <Select value={taskDatasetId} onValueChange={setTaskDatasetId}>
                      <SelectTrigger><SelectValue placeholder="数据集" /></SelectTrigger>
                      <SelectContent>{datasets.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">配置</div>
                    <Select value={taskProfileId} onValueChange={setTaskProfileId}>
                      <SelectTrigger><SelectValue placeholder="配置" /></SelectTrigger>
                      <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">并发数</div>
                    <Input value={taskConcurrency} onChange={(e) => setTaskConcurrency(e.target.value)} placeholder="并发" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">超时 (ms)</div>
                    <Input value={taskTimeoutMs} onChange={(e) => setTaskTimeoutMs(e.target.value)} placeholder="timeout ms" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium">重试次数</div>
                    <Input value={taskRetry} onChange={(e) => setTaskRetry(e.target.value)} placeholder="重试次数" />
                  </div>
                </div>
                <Button onClick={createTask}>创建任务</Button>

                <Separator />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务ID</TableHead>
                      <TableHead>数据集/配置</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>进度</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => {
                      const pct = Math.min(100, Math.round(((task.successRows + task.failedRows) / Math.max(1, task.totalRows)) * 100));
                      const isFinished = task.status === "completed" || task.status === "stopped";
                      return (
                        <TableRow key={task.id}>
                          <TableCell className="font-mono text-xs">{task.id.slice(0, 12)}</TableCell>
                          <TableCell>{task.dataset.name} / {task.profile.name}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateTime(task.createdAt)}</TableCell>
                          <TableCell><Badge>{task.status}</Badge></TableCell>
                          <TableCell className="w-[220px]"><Progress value={pct} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {!isFinished ? (
                                <>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm">控制</Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem onClick={() => controlTask(task.id, "pause")}>暂停</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => controlTask(task.id, "resume")}>继续</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm">终止</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>确认终止任务？</AlertDialogTitle>
                                        <AlertDialogDescription>终止后任务将不会继续处理剩余行。</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => controlTask(task.id, "stop")}>确认终止</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => jumpToTaskResults(task.id)}>导出</Button>

                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="outline" size="sm">删除</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>确认删除任务？</AlertDialogTitle>
                                        <AlertDialogDescription>删除后该任务结果会从数据库中同步清除。</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteTask(task.id)}>确认删除</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-medium">实时输出预览</div>
                    <Select value={previewTaskId} onValueChange={setPreviewTaskId}>
                      <SelectTrigger className="w-[360px]"><SelectValue placeholder="选择任务" /></SelectTrigger>
                      <SelectContent>
                        {tasks.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.id.slice(0, 8)} - {t.profile.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => loadLivePreview().catch((e) => toast.error(e.message))}>刷新</Button>
                  </div>

                  <ScrollArea className="h-72 rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>行号</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>延迟(ms)</TableHead>
                          <TableHead>回复内容</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {liveRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.rowIndex}</TableCell>
                            <TableCell><Badge variant={row.status === "failed" ? "destructive" : "secondary"}>{row.status}</Badge></TableCell>
                            <TableCell>{row.latencyMs ?? "-"}</TableCell>
                            <TableCell className="max-w-[620px] truncate">{getReplyPreview(row.outputs)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle>结果查询与导出</CardTitle>
                <CardDescription>查看行级结果、错误原因、导出报表</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={resultTaskId}
                    onValueChange={(v) => {
                      setResultTaskId(v);
                      setSelectedExportColumns([]);
                      setResultPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[360px]"><SelectValue placeholder="选择任务" /></SelectTrigger>
                    <SelectContent>
                      {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.id.slice(0, 8)} - {t.profile.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => exportTask("xlsx")}>导出 XLSX</Button>
                  <Button variant="outline" onClick={() => exportTask("csv")}>导出 CSV</Button>
                  <Button variant="outline" onClick={loadResults}>刷新</Button>
                </div>

                <div className="grid grid-cols-1 gap-4 rounded-md border p-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">可选导出列</div>
                    <ScrollArea className="h-48 rounded border">
                      <div className="space-y-1 p-2">
                        {availableExportColumns.map((column) => (
                          <div key={column} className="flex items-center justify-between gap-2 rounded border p-2">
                            <div className="text-xs">{getColumnLabel(column)}</div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addExportColumn(column)}
                              disabled={selectedExportColumns.includes(column)}
                            >
                              添加
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm font-medium">已选导出列（按顺序导出）</div>
                    <ScrollArea className="h-48 rounded border">
                      <div className="space-y-1 p-2">
                        {selectedExportColumns.map((column, index) => (
                          <div key={`${column}-${index}`} className="flex items-center justify-between gap-2 rounded border p-2">
                            <div className="text-xs">{index + 1}. {getColumnLabel(column)}</div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="outline" onClick={() => moveExportColumn(index, -1)} disabled={index === 0}>上移</Button>
                              <Button size="sm" variant="outline" onClick={() => moveExportColumn(index, 1)} disabled={index === selectedExportColumns.length - 1}>下移</Button>
                              <Button size="sm" variant="destructive" onClick={() => removeExportColumn(column)}>移除</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {selectedTask ? (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      总行数 {selectedTask.totalRows}，成功 {selectedTask.successRows}，失败 {selectedTask.failedRows}，平均 TTFT{" "}
                      {avgTtftMs == null ? "-" : `${Math.round(avgTtftMs)} ms`}
                    </div>
                    <Progress value={progress} />
                  </div>
                ) : null}

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>TTFT(ms)</TableHead>
                      <TableHead>总耗时(ms)</TableHead>
                      <TableHead>结束原因</TableHead>
                      <TableHead>错误</TableHead>
                      <TableHead>详情</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resultRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.rowIndex}</TableCell>
                        <TableCell><Badge variant={row.status === "failed" ? "destructive" : "secondary"}>{row.status}</Badge></TableCell>
                        <TableCell>{row.ttftMs ?? "-"}</TableCell>
                        <TableCell>{row.latencyMs ?? "-"}</TableCell>
                        <TableCell>{row.endReason ?? "-"}</TableCell>
                        <TableCell>{row.errorType ?? "-"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setDetailText(JSON.stringify(row, null, 2));
                              setDetailOpen(true);
                            }}
                          >
                            查看
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setResultPage((p) => Math.max(1, p - 1)); }} />
                    </PaginationItem>
                    <PaginationItem className="px-3 text-sm">{resultPage} / {maxPage}</PaginationItem>
                    <PaginationItem>
                      <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setResultPage((p) => Math.min(maxPage, p + 1)); }} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] max-w-4xl overflow-hidden p-0">
          <DialogHeader>
            <DialogTitle className="px-6 pt-6">结果详情</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <ScrollArea className="h-[70vh] w-full rounded border p-3">
              <pre className="whitespace-pre-wrap break-words text-xs">{detailText}</pre>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
