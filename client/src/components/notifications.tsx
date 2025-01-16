import { Bell } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

type Notification = {
  id: number;
  title: string;
  message: string;
  type: "form_approval" | "form_approved" | "form_rejected" | "other";
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
};

export function NotificationsButton() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  // Connect to WebSocket for real-time notifications
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "notification") {
        // Update notifications cache
        queryClient.setQueryData<Notification[]>(
          ["/api/notifications"],
          (old = []) => [data.data, ...old]
        );
      }
    };

    return () => {
      ws.close();
    };
  }, [queryClient]);

  // Mark notification as read
  const markAsRead = async (id: number) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: "PUT",
      credentials: "include",
    });
    
    // Update cache
    queryClient.setQueryData<Notification[]>(
      ["/api/notifications"],
      (old = []) => old.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-6rem)] mt-6">
          <div className="space-y-4 pr-4">
            {notifications.map((notification) => (
              <Card
                key={notification.id}
                className={notification.read ? "opacity-60" : ""}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{notification.title}</CardTitle>
                      <CardDescription className="mt-1.5">
                        {notification.message}
                      </CardDescription>
                    </div>
                    {!notification.read && (
                      <Badge variant="default">New</Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-2">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
            {notifications.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No notifications yet
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
