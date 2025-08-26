import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Download, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle,
  Database,
  HardDrive,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  exportBackupFile, 
  importBackupFile, 
  getBackupInfo,
  loadSnapshotFromLocalStorage,
  restoreFromSnapshot,
  aggregateAllData,
  saveSnapshotToLocalStorage
} from "@/utils/backup";
import { StorageService } from "@/storage/StorageService";
import { formatCurrency } from "@/utils/currency";

interface BackupManagerProps {
  storage: StorageService;
  onRestore?: () => void;
}

export const BackupManager: React.FC<BackupManagerProps> = ({ storage, onRestore }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [backupInfo, setBackupInfo] = useState(getBackupInfo());
  const [storageQuota, setStorageQuota] = useState<{ usage?: number; quota?: number }>({});

  const refreshBackupInfo = useCallback(() => {
    setBackupInfo(getBackupInfo());
  }, []);

  const checkStorageQuota = useCallback(async () => {
    if (navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        setStorageQuota(estimate);
      } catch (error) {
        console.warn('Could not estimate storage:', error);
      }
    }
  }, []);

  React.useEffect(() => {
    checkStorageQuota();
  }, [checkStorageQuota]);

  const handleExport = async () => {
    setLoading(true);
    try {
      await exportBackupFile(storage);
      toast({
        title: "Backup Exported",
        description: "Your shop data has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export backup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await importBackupFile(storage, file);
      toast({
        title: "Backup Imported",
        description: "Your shop data has been restored successfully.",
      });
      onRestore?.();
    } catch (error) {
      toast({
        title: "Import Failed", 
        description: error instanceof Error ? error.message : "Failed to import backup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleRestoreFromLocal = async (backupKey: 'latest' | 'prev1' | 'prev2') => {
    setLoading(true);
    try {
      const snapshot = await loadSnapshotFromLocalStorage(backupKey);
      if (!snapshot) {
        toast({
          title: "Restore Failed",
          description: "No valid backup found or backup is corrupted.",
          variant: "destructive",
        });
        return;
      }

      await restoreFromSnapshot(storage, snapshot);
      toast({
        title: "Database Restored",
        description: `Restored from backup: ${new Date(snapshot.timestamp).toLocaleString()}`,
      });
      onRestore?.();
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: error instanceof Error ? error.message : "Failed to restore from backup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const snapshot = await aggregateAllData(storage);
      await saveSnapshotToLocalStorage(snapshot);
      refreshBackupInfo();
      toast({
        title: "Backup Created",
        description: "A new backup has been saved locally.",
      });
    } catch (error) {
      toast({
        title: "Backup Failed",
        description: error instanceof Error ? error.message : "Failed to create backup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatSize = (bytes: number) => {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${kb.toFixed(1)} KB`;
  };

  const getStorageUsagePercent = () => {
    if (!storageQuota.usage || !storageQuota.quota) return 0;
    return (storageQuota.usage / storageQuota.quota) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Storage Status */}
      {storageQuota.quota && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Storage Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>Used: {formatSize(storageQuota.usage || 0)}</span>
              <span>Available: {formatSize(storageQuota.quota)}</span>
            </div>
            <Progress value={getStorageUsagePercent()} className="h-2" />
            {getStorageUsagePercent() > 80 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Storage is nearly full ({getStorageUsagePercent().toFixed(0)}%). 
                  Consider exporting and clearing old data.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Local Backups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5" />
            Local Backups
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {backupInfo.backupCount} backup(s) available
              </p>
              {backupInfo.lastBackup && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  Last: {new Date(backupInfo.lastBackup).toLocaleString()}
                </div>
              )}
            </div>
            <Button onClick={handleCreateBackup} disabled={loading} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Create Backup
            </Button>
          </div>

          {backupInfo.backupCount > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Restore Options</h4>
                <div className="grid gap-2">
                  <Button 
                    onClick={() => handleRestoreFromLocal('latest')}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Restore Latest Backup
                  </Button>
                  <Button 
                    onClick={() => handleRestoreFromLocal('prev1')}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    Restore Previous Backup
                  </Button>
                  <Button 
                    onClick={() => handleRestoreFromLocal('prev2')}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                  >
                    Restore Older Backup
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Import/Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Backup Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleExport} disabled={loading} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export Backup
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={loading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button disabled={loading} variant="outline" className="w-full">
                <Upload className="w-4 h-4 mr-2" />
                Import Backup
              </Button>
            </div>
          </div>
          
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Importing will replace all current data. Make sure to export your current data first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Backup Info */}
      {backupInfo.totalSize > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total backup size:</span>
              <Badge variant="outline">{formatSize(backupInfo.totalSize)}</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};