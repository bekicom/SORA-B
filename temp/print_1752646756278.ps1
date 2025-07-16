
        $html = Get-Content "D:\REAL LOYHALAR\======SORA-KAFE=======\SORA-B\temp\receipt_1752646756277.html" -Raw
        $ie = New-Object -ComObject InternetExplorer.Application
        $ie.Visible = $false
        $ie.Navigate2("about:blank")
        while($ie.Busy) { Start-Sleep -Milliseconds 100 }
        $ie.Document.Write($html)
        $ie.Document.Close()
        Start-Sleep -Seconds 2
        $ie.ExecWB(6, 2)  # Print command
        Start-Sleep -Seconds 3
        $ie.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ie)
      