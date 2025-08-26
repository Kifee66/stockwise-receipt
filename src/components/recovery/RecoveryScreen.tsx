import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  Database, 
  Upload, 
  RefreshCw,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  loadSnapshotFromLocalStorage,
  restoreFromSnapshot,
  importBackupFile,
} from "@/utils/backup";
import { StorageService } from "@/storage/StorageService";

interface RecoveryScreenProps {
  storage: StorageService;
  onRecovered: () => void;
}

export const RecoveryScreen: React.FC<RecoveryScreenProps> = ({ storage, onRecovered }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<string[]>([]);

  React.useEffect(() => {
    // Check available local backups
    const backups = [];
    if (localStorage.getItem("shop.backup.latest")) backups.push("Latest Backup");
    if (localStorage.getItem("shop.backup.prev1")) backups.push("Previous Backup");
    if (localStorage.getItem("shop.backup.prev2")) backups.push("Older Backup");
    setAvailableBackups(backups);
  }, []);

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
        description: `Successfully restored from backup: ${new Date(snapshot.timestamp).toLocaleString()}`,
      });
      onRecovered();
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

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      await importBackupFile(storage, file);
      toast({
        title: "Backup Imported",
        description: "Your shop data has been restored successfully.",
      });
      onRecovered();
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import backup",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  const handleStartFresh = () => {
    toast({
      title: "Starting Fresh",
      description: "You can begin adding products and recording sales.",
    });
    onRecovered();
  };

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto flex items-center justify-center">
      <Card className="w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Database Recovery</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              Your shop database appears to be empty or corrupted. 
              Choose a recovery option below to restore your data.
            </AlertDescription>
          </Alert>

          {/* Local Backups */}
          {availableBackups.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Restore from Local Backup</h3>
              <div className="space-y-2">
                {availableBackups.includes("Latest Backup") && (
                  <Button 
                    onClick={() => handleRestoreFromLocal('latest')}
                    disabled={loading}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Restore Latest Backup
                  </Button>
                )}
                {availableBackups.includes("Previous Backup") && (
                  <Button 
                    onClick={() => handleRestoreFromLocal('prev1')}
                    disabled={loading}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Restore Previous Backup
                  </Button>
                )}
                {availableBackups.includes("Older Backup") && (
                  <Button 
                    onClick={() => handleRestoreFromLocal('prev2')}
                    disabled={loading}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Restore Older Backup
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Import from File */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Import Backup File</h3>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                disabled={loading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button disabled={loading} variant="outline" className="w-full justify-start">
                <Upload className="w-4 h-4 mr-2" />
                Import Backup File
              </Button>
            </div>
          </div>

          {/* Start Fresh */}
          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-medium text-sm">Start Fresh</h3>
            <Button 
              onClick={handleStartFresh}
              disabled={loading}
              variant="default"
              className="w-full"
            >
              Start with Empty Database
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This will create a new empty database. You can always import data later.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};