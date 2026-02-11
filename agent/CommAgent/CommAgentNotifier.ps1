# CommAgentNotifier.ps1
# Notificatore WPF Premium - Logika Communication Agent
# Mostra notifiche toast innovative con animazioni e design glassmorphism
# Versione: 1.0.0

param(
    [string]$Title = "",
    [string]$Body = "",
    [string]$Sender = "",
    [string]$Priority = "normal",
    [string]$Category = "info"
)

# Decodifica Base64
try {
    if ($Title) { $Title = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Title)) }
    if ($Body) { $Body = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Body)) }
    if ($Sender) { $Sender = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Sender)) }
}
catch {
    # Se non è Base64, usa il valore originale
}

if (-not $Title) { $Title = "Notifica" }
if (-not $Body) { $Body = "Nessun contenuto" }
if (-not $Sender) { $Sender = "Logika Service" }

# Carica assemblies WPF
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms

# ============================================
# COLORI PER CATEGORIA/PRIORITÀ
# ============================================
$colorSchemes = @{
    "info"        = @{ Bg1 = "#667EEA"; Bg2 = "#764BA2"; Icon = "💬"; AccentBorder = "#8B9CF7" }
    "warning"     = @{ Bg1 = "#F093FB"; Bg2 = "#F5576C"; Icon = "⚠️"; AccentBorder = "#F5A0C0" }
    "maintenance" = @{ Bg1 = "#4FACFE"; Bg2 = "#00F2FE"; Icon = "🔧"; AccentBorder = "#7BC4FF" }
    "update"      = @{ Bg1 = "#43E97B"; Bg2 = "#38F9D7"; Icon = "🔄"; AccentBorder = "#6BFFB3" }
    "urgent"      = @{ Bg1 = "#FA709A"; Bg2 = "#FEE140"; Icon = "🚨"; AccentBorder = "#FFB082" }
}

# Override per priorità urgente
if ($Priority -eq "urgent") { $Category = "urgent" }
if ($Priority -eq "high" -and $Category -eq "info") { $Category = "warning" }

$scheme = $colorSchemes[$Category]
if (-not $scheme) { $scheme = $colorSchemes["info"] }

$icon = $scheme.Icon
$bg1 = $scheme.Bg1
$bg2 = $scheme.Bg2
$accentBorder = $scheme.AccentBorder
$timestamp = Get-Date -Format "HH:mm"

# ============================================
# SUONO NOTIFICA
# ============================================
try {
    [System.Media.SystemSounds]::Asterisk.Play()
}
catch { }

# ============================================
# XAML DELLA NOTIFICA
# ============================================
$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Logika Notification"
        Width="420" Height="Auto" MinHeight="160" MaxHeight="350"
        WindowStyle="None" AllowsTransparency="True" Background="Transparent"
        Topmost="True" ShowInTaskbar="False" ResizeMode="NoResize"
        WindowStartupLocation="Manual">

    <Window.Resources>
        <Storyboard x:Key="SlideIn">
            <DoubleAnimation Storyboard.TargetProperty="(Window.Opacity)" From="0" To="1" Duration="0:0:0.4">
                <DoubleAnimation.EasingFunction>
                    <CubicEase EasingMode="EaseOut"/>
                </DoubleAnimation.EasingFunction>
            </DoubleAnimation>
            <ThicknessAnimation Storyboard.TargetName="MainBorder" Storyboard.TargetProperty="Margin"
                                From="40,20,0,0" To="0,0,0,0" Duration="0:0:0.5">
                <ThicknessAnimation.EasingFunction>
                    <CubicEase EasingMode="EaseOut"/>
                </ThicknessAnimation.EasingFunction>
            </ThicknessAnimation>
        </Storyboard>
        <Storyboard x:Key="SlideOut">
            <DoubleAnimation Storyboard.TargetProperty="(Window.Opacity)" From="1" To="0" Duration="0:0:0.3">
                <DoubleAnimation.EasingFunction>
                    <CubicEase EasingMode="EaseIn"/>
                </DoubleAnimation.EasingFunction>
            </DoubleAnimation>
            <ThicknessAnimation Storyboard.TargetName="MainBorder" Storyboard.TargetProperty="Margin"
                                From="0,0,0,0" To="40,0,0,0" Duration="0:0:0.3">
                <ThicknessAnimation.EasingFunction>
                    <CubicEase EasingMode="EaseIn"/>
                </ThicknessAnimation.EasingFunction>
            </ThicknessAnimation>
        </Storyboard>
    </Window.Resources>

    <Border x:Name="MainBorder" CornerRadius="16" Margin="0"
            Background="Transparent">
        <Border.Effect>
            <DropShadowEffect BlurRadius="25" ShadowDepth="5" Opacity="0.4" Color="#000000"/>
        </Border.Effect>

        <Grid>
            <!-- Background principale con gradiente -->
            <Border CornerRadius="16">
                <Border.Background>
                    <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                        <GradientStop Color="${bg1}" Offset="0"/>
                        <GradientStop Color="${bg2}" Offset="1"/>
                    </LinearGradientBrush>
                </Border.Background>
            </Border>

            <!-- Overlay semi-trasparente tipo glassmorphism -->
            <Border CornerRadius="16" Background="#20FFFFFF"/>

            <!-- Decorazione cerchio in alto a destra -->
            <Ellipse Width="120" Height="120" HorizontalAlignment="Right" VerticalAlignment="Top"
                     Margin="0,-30,-30,0" Opacity="0.1">
                <Ellipse.Fill>
                    <RadialGradientBrush>
                        <GradientStop Color="White" Offset="0"/>
                        <GradientStop Color="Transparent" Offset="1"/>
                    </RadialGradientBrush>
                </Ellipse.Fill>
            </Ellipse>

            <!-- Decorazione cerchio in basso a sinistra -->
            <Ellipse Width="80" Height="80" HorizontalAlignment="Left" VerticalAlignment="Bottom"
                     Margin="-20,0,0,-20" Opacity="0.08">
                <Ellipse.Fill>
                    <RadialGradientBrush>
                        <GradientStop Color="White" Offset="0"/>
                        <GradientStop Color="Transparent" Offset="1"/>
                    </RadialGradientBrush>
                </Ellipse.Fill>
            </Ellipse>

            <!-- Contenuto -->
            <Grid Margin="20,16,20,16">
                <Grid.RowDefinitions>
                    <RowDefinition Height="Auto"/>
                    <RowDefinition Height="Auto"/>
                    <RowDefinition Height="Auto"/>
                    <RowDefinition Height="Auto"/>
                </Grid.RowDefinitions>

                <!-- Header: Logo + Close -->
                <Grid Grid.Row="0" Margin="0,0,0,10">
                    <Grid.ColumnDefinitions>
                        <ColumnDefinition Width="Auto"/>
                        <ColumnDefinition Width="*"/>
                        <ColumnDefinition Width="Auto"/>
                        <ColumnDefinition Width="Auto"/>
                    </Grid.ColumnDefinitions>

                    <!-- Icona categoria -->
                    <Border Grid.Column="0" Width="36" Height="36" CornerRadius="10"
                            Background="#30FFFFFF" Margin="0,0,10,0">
                        <TextBlock Text="${icon}" FontSize="18"
                                   HorizontalAlignment="Center" VerticalAlignment="Center"/>
                    </Border>

                    <!-- Sender + Timestamp -->
                    <StackPanel Grid.Column="1" VerticalAlignment="Center">
                        <TextBlock Text="${Sender}" FontSize="13" FontWeight="SemiBold"
                                   Foreground="White" TextTrimming="CharacterEllipsis"/>
                        <TextBlock Text="${timestamp}" FontSize="10" Foreground="#B0FFFFFF" Margin="0,1,0,0"/>
                    </StackPanel>

                    <!-- Badge priorità -->
                    <Border Grid.Column="2" CornerRadius="8" Padding="8,3" Margin="5,0"
                            Background="#25FFFFFF" VerticalAlignment="Center"
                            Visibility="${if ($Priority -ne 'normal') { 'Visible' } else { 'Collapsed' }}">
                        <TextBlock Text="${Priority.ToUpper()}" FontSize="9" FontWeight="Bold"
                                   Foreground="White"/>
                    </Border>

                    <!-- Close button -->
                    <Border Grid.Column="3" Width="28" Height="28" CornerRadius="14"
                            Background="#30FFFFFF" Cursor="Hand"
                            x:Name="CloseBtn" MouseDown="CloseBtn_MouseDown">
                        <TextBlock Text="✕" FontSize="12" Foreground="White"
                                   HorizontalAlignment="Center" VerticalAlignment="Center"/>
                    </Border>
                </Grid>

                <!-- Linea separatrice -->
                <Border Grid.Row="1" Height="1" Background="#25FFFFFF" Margin="0,0,0,10"
                        CornerRadius="1"/>

                <!-- Titolo -->
                <TextBlock Grid.Row="2" Text="${Title}" FontSize="16" FontWeight="Bold"
                           Foreground="White" TextWrapping="Wrap" Margin="0,0,0,6"
                           MaxHeight="50" TextTrimming="CharacterEllipsis"/>

                <!-- Corpo del messaggio -->
                <TextBlock Grid.Row="3" Text="${Body}" FontSize="13"
                           Foreground="#E0FFFFFF" TextWrapping="Wrap"
                           MaxHeight="80" TextTrimming="CharacterEllipsis"
                           LineHeight="18"/>
            </Grid>

            <!-- Progress bar auto-dismiss in basso -->
            <Border CornerRadius="0,0,16,16" VerticalAlignment="Bottom" Height="4"
                    Background="Transparent" ClipToBounds="True">
                <Border x:Name="ProgressBar" Height="4" Background="#50FFFFFF"
                        HorizontalAlignment="Left" Width="420" CornerRadius="0,0,16,16"/>
            </Border>
        </Grid>
    </Border>
</Window>
"@

# ============================================
# CREA E MOSTRA LA FINESTRA
# ============================================
try {
    # Parse XAML
    $reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]::new($xaml))
    $window = [System.Windows.Markup.XamlReader]::Load($reader)

    # Posiziona in basso a destra
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $window.Left = $screen.Right - $window.Width - 20
    $window.Top = $screen.Bottom - 200

    # Gestisci drag della finestra
    $window.Add_MouseLeftButtonDown({
            try { $window.DragMove() } catch { }
        })

    # Close button
    $closeBtn = $window.FindName("CloseBtn")
    if ($closeBtn) {
        $closeBtn.Add_MouseDown({
                # Animazione uscita
                try {
                    $storyboard = $window.FindResource("SlideOut")
                    $storyboard.Completed.Add({
                            $window.Close()
                        }.GetNewClosure())
                    $storyboard.Begin($window)
                }
                catch {
                    $window.Close()
                }
            }.GetNewClosure())
    }

    # Animazione ingresso
    $window.Add_Loaded({
            try {
                $storyboard = $window.FindResource("SlideIn")
                $storyboard.Begin($window)
            }
            catch { }
        }.GetNewClosure())

    # Auto-dismiss dopo 12 secondi con animazione progress bar
    $autoCloseTimer = New-Object System.Windows.Threading.DispatcherTimer
    $autoCloseTimer.Interval = [TimeSpan]::FromMilliseconds(50)
    $elapsed = 0
    $duration = 12000  # 12 secondi

    $progressBar = $window.FindName("ProgressBar")

    $autoCloseTimer.Add_Tick({
            $elapsed += 50
            # Anima progress bar
            if ($progressBar) {
                $pct = 1 - ($elapsed / $duration)
                $progressBar.Width = 420 * $pct
            }

            if ($elapsed -ge $duration) {
                $autoCloseTimer.Stop()
                try {
                    $storyboard = $window.FindResource("SlideOut")
                    $storyboard.Completed.Add({
                            $window.Close()
                        }.GetNewClosure())
                    $storyboard.Begin($window)
                }
                catch {
                    $window.Close()
                }
            }
        }.GetNewClosure())

    $window.Add_ContentRendered({
            $autoCloseTimer.Start()
        }.GetNewClosure())

    # Pausa auto-dismiss su hover
    $mainBorder = $window.FindName("MainBorder")
    if ($mainBorder) {
        $mainBorder.Add_MouseEnter({
                $autoCloseTimer.Stop()
            }.GetNewClosure())
        $mainBorder.Add_MouseLeave({
                $autoCloseTimer.Start()
            }.GetNewClosure())
    }

    # Mostra la finestra
    $window.ShowDialog() | Out-Null

}
catch {
    # Fallback se WPF fallisce
    try {
        [System.Windows.Forms.MessageBox]::Show(
            "$Body`n`nDa: $Sender",
            "Logika: $Title",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    }
    catch { }
}
